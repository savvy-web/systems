import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Packaging regression guard for issue #97.
 *
 * The published tarball must ship every runtime module that `bin` and `exports`
 * reach. A previous `"files": ["public"]` allowlist excluded the per-module
 * runtime `.js` files, so `bin/savvy-mcp.js` imported `../runtime.js` from a
 * tarball that did not contain it and the server crashed on launch with
 * `ERR_MODULE_NOT_FOUND`. This test resolves the published module graph against
 * the actual `npm pack` file list, so re-introducing an over-narrow allowlist
 * (or an entry pointing at an unshipped file) fails here instead of in the wild.
 *
 * The resource subsystem (the markdown corpus, its manifest, and the
 * doc-search tool) has been removed, so this file also asserts the
 * tarball ships no doc corpus content.
 */

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");

/** Prefer the prod npm group, fall back to the dev build produced on install. */
function resolvePackedDir(): string {
	const candidates = [join(pkgRoot, "dist/prod/npm/pkg"), join(pkgRoot, "dist/dev/pkg")];
	const found = candidates.find((dir) => existsSync(join(dir, "package.json")));
	if (!found) {
		throw new Error(
			`No built package found. Run \`pnpm --filter @savvy-web/mcp build:dev\` before this test. Looked in:\n${candidates.join("\n")}`,
		);
	}
	return found;
}

/** The exact set of files `npm pack` would ship, as posix-style relative paths. */
function packedFiles(dir: string): Set<string> {
	const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: dir, encoding: "utf8" });
	const [result] = JSON.parse(raw) as Array<{ files: Array<{ path: string }> }>;
	return new Set(result.files.map((f) => f.path));
}

/** Collect the `.js` targets a manifest entry can resolve to (string or conditions). */
function jsTargets(value: unknown, out: Set<string>): void {
	if (typeof value === "string") {
		if (value.endsWith(".js")) out.add(value.replace(/^\.\//, ""));
		return;
	}
	if (value && typeof value === "object") {
		for (const v of Object.values(value as Record<string, unknown>)) jsTargets(v, out);
	}
}

const RELATIVE_IMPORT = /(?:from|import|export\s+\*\s+from)\s*["'](\.[^"']+)["']/g;

describe("published tarball (issue #97)", () => {
	const dir = resolvePackedDir();
	const packed = packedFiles(dir);
	const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
		bin?: Record<string, string>;
		exports?: unknown;
	};

	// Entry points the consumer is promised: every bin target + every exports JS target.
	const entries = new Set<string>();
	for (const target of Object.values(manifest.bin ?? {})) jsTargets(target, entries);
	jsTargets(manifest.exports, entries);

	it("ships every bin and exports entry point", () => {
		const missing = [...entries].filter((e) => !packed.has(e));
		expect(missing, `entry points declared in package.json but absent from the tarball`).toEqual([]);
	});

	it("ships every runtime module reachable from the entry points", () => {
		const seen = new Set<string>();
		const queue = [...entries];
		const missing: Array<{ from: string; imports: string }> = [];

		while (queue.length > 0) {
			const file = queue.shift();
			if (file === undefined || seen.has(file)) continue;
			seen.add(file);
			if (!packed.has(file)) continue; // missing entry points are asserted above

			const source = readFileSync(join(dir, file), "utf8");
			for (const match of source.matchAll(RELATIVE_IMPORT)) {
				const spec = match[1];
				if (!spec.endsWith(".js")) continue; // bare type/asset specifiers are not runtime modules
				const resolved = posix.normalize(posix.join(posix.dirname(file), spec));
				if (!packed.has(resolved)) {
					missing.push({ from: file, imports: spec });
				} else {
					queue.push(resolved);
				}
			}
		}

		expect(
			missing,
			`runtime modules imported by published code but absent from the tarball:\n${missing
				.map((m) => `  ${m.from} -> ${m.imports}`)
				.join("\n")}`,
		).toEqual([]);
	});

	it("ships no doc corpus (resource subsystem removed)", () => {
		const corpus = [...packed].filter((p) => p.startsWith("content/"));
		expect(corpus, "tarball still ships corpus content after the resource subsystem removal").toEqual([]);
	});

	it("does not declare a files allowlist that excludes the build output", () => {
		// The repo convention is to let the clean build-output directory be the
		// implicit allowlist (every other package omits `files`). A `files` field
		// here is what re-introduces issue #97.
		const sourceManifest = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
			files?: unknown;
		};
		expect(
			sourceManifest.files,
			`${relative(pkgRoot, join(pkgRoot, "package.json"))} should omit \`files\``,
		).toBeUndefined();
	});
});
