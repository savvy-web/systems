/**
 * Guards the externalization contract of silk's built artifacts.
 *
 * @remarks
 * A dependency silk declares but never imports from its OWN source looks
 * unused to every source-level search, and removing it still passes
 * `pnpm build`, `types:check` and the whole test suite. What it silently
 * changes is the BUNDLE: tsdown auto-externalizes from the manifest, so
 * dropping the declaration makes rolldown inline that package's source into
 * the artifacts instead of leaving an `import` for the consumer to resolve.
 *
 * `semver` is the live case. Nothing in `src/` imports it — the importers are
 * the `@changesets/*` packages inside `@savvy-web/silk-effects`' transitive
 * tree, force-bundled into the changelog and markdownlint entries (which must
 * stay CJS-requireable and so cannot externalize ESM-only silk-effects; see
 * the systems#469 determination in savvy.build.ts). Inlining it pulls semver's circular
 * CommonJS modules into the ESM output, which is the documented
 * `require_range is not a function` init-order hazard.
 *
 * These assertions read the built output rather than the manifest, because the
 * manifest is the input to the behavior under test, not evidence of it.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Identifiers that only appear when npm `semver`'s source has been inlined. */
const SEMVER_INTERNALS = [
	"MAX_SAFE_COMPONENT_LENGTH",
	"SEMVER_SPEC_VERSION",
	"comparatorTrimReplace",
	"require_range",
] as const;

/**
 * Collect every emitted JS artifact for a build target, recursively — the
 * bundler emits per-module chunks under subdirectories, so a top-level glob
 * misses most of them.
 */
const collectArtifacts = (dir: string): string[] => {
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return [];
	}
	const out: string[] = [];
	for (const name of names) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			out.push(...collectArtifacts(full));
		} else if (/\.(js|cjs|mjs)$/.test(name)) {
			out.push(full);
		}
	}
	return out;
};

describe("built artifact externals", () => {
	const targets = ["dist/prod/npm/pkg", "dist/dev/pkg"].map((rel) => ({
		rel,
		files: collectArtifacts(join(PKG_ROOT, rel)),
	}));
	const built = targets.filter((t) => t.files.length > 0);

	it("finds at least one built target to inspect", () => {
		// Guards against the assertions below passing vacuously on an unbuilt tree.
		expect(built.length).toBeGreaterThan(0);
	});

	for (const { rel, files } of built) {
		describe(rel, () => {
			it("does not inline npm semver's source", () => {
				const offenders: string[] = [];
				for (const file of files) {
					const content = readFileSync(file, "utf-8");
					const hit = SEMVER_INTERNALS.find((id) => content.includes(id));
					if (hit) {
						offenders.push(`${file.slice(PKG_ROOT.length + 1)} (${hit})`);
					}
				}

				// If this fails, `semver` was dropped from package.json dependencies or
				// from the manifest keep-list in savvy.build.ts. It must stay in both.
				expect(offenders).toEqual([]);
			});

			it("keeps the search honest with a control identifier that IS present", () => {
				// Proves the scan would actually find inlined source if it were there —
				// without this, an empty offenders list could mean "clean" or "looked in
				// the wrong place", and those are not the same result.
				const anyEffectUsage = files.some((file) => readFileSync(file, "utf-8").includes("effect"));
				expect(anyEffectUsage).toBe(true);
			});
		});
	}
});

describe("published manifest covers silk-effects' required peers", () => {
	// silk externalizes @savvy-web/silk-effects and re-adds it to the published
	// manifest, so a consumer installing silk resolves silk-effects transitively
	// and inherits its REQUIRED peers. Nothing else in the published graph names
	// them, so if silk does not carry them the peers go unsatisfied: silently
	// duplicated under pnpm's autoInstallPeers, ERR_MODULE_NOT_FOUND under yarn
	// or with autoInstallPeers off.
	//
	// Two sites have to agree for that to work — silk's `dependencies` AND the
	// `kept` allowlist in savvy.build.ts, which filters the published manifest
	// down. Adding to one alone is a no-op, which is how this shipped unnoticed.
	// These assertions read the BUILT manifest, so they fail if either site drifts.
	const builtManifest = join(PKG_ROOT, "dist/dev/pkg/package.json");
	const effectsManifest = join(PKG_ROOT, "../silk-effects/package.json");

	const requiredPeers = Object.keys(
		(JSON.parse(readFileSync(effectsManifest, "utf-8")) as { peerDependencies?: Record<string, string> })
			.peerDependencies ?? {},
	);
	const published =
		(JSON.parse(readFileSync(builtManifest, "utf-8")) as { dependencies?: Record<string, string> }).dependencies ?? {};

	it("declares every peer silk-effects requires", () => {
		const missing = requiredPeers.filter((name) => published[name] === undefined);
		expect(missing).toEqual([]);
	});

	it("keeps the check honest — silk-effects itself is a published dependency", () => {
		// The premise of the test above: silk really does ship silk-effects as a
		// runtime dependency. If this ever stops being true the peers stop being
		// inherited, and an empty `missing` list above would mean "nothing to
		// cover" rather than "everything covered".
		expect(published["@savvy-web/silk-effects"]).toBeDefined();
		expect(requiredPeers.length).toBeGreaterThan(0);
	});
});

describe("silk-effects externalization split", () => {
	// silk-effects is a DECLARED runtime dependency, which makes tsdown auto-externalize
	// it everywhere. That is the right posture for the base ESM entries (consumers
	// resolve the `import`), and the WRONG one for the two CJS override partitions:
	// CJS cannot `require()` ESM-only silk-effects, so those partitions force-inline it
	// via the override-level `bundle` knob in savvy.build.ts. These assertions pin both
	// halves against the built output, so dropping `bundle` from an override (or the
	// `externals` entry from the base) fails here instead of at a consumer's require().
	const targets = ["dist/prod/npm/pkg", "dist/dev/pkg"].map((rel) => ({
		rel,
		files: collectArtifacts(join(PKG_ROOT, rel)),
	}));
	const built = targets.filter((t) => t.files.length > 0);

	for (const { rel, files } of built) {
		describe(rel, () => {
			const cjs = files.filter((f) => f.endsWith(".cjs"));
			// Base ESM entries only: the two override partitions' `.js` twins inline silk-effects
			// just like their `.cjs`, so they are excluded from the externalization assertion.
			const baseEsmEntries = files.filter(
				(f) => /\/(changesets|changesets-remark|commitlint(-[a-z]+)?|lint)\.js$/.test(f) && !f.includes("/bin/"),
			);

			it("inlines silk-effects into every CJS artifact (no external require)", () => {
				expect(cjs.length).toBeGreaterThan(0);
				const offenders = cjs.filter((f) => /require\(["']@savvy-web\/silk-effects/.test(readFileSync(f, "utf-8")));
				expect(offenders.map((f) => f.slice(PKG_ROOT.length + 1))).toEqual([]);
			});

			it("externalizes silk-effects from the base ESM entries (import stays external)", () => {
				expect(baseEsmEntries.length).toBeGreaterThan(0);
				// A real import STATEMENT at line start — not a doc comment quoting one.
				const importing = baseEsmEntries.filter((f) =>
					/^import .* from ["']@savvy-web\/silk-effects["'];?$/m.test(readFileSync(f, "utf-8")),
				);
				const names = importing.map((f) => f.slice(f.lastIndexOf("/") + 1));
				// Every base entry that touches silk-effects does so through an external import.
				expect(names).toEqual(expect.arrayContaining(["changesets.js", "commitlint.js", "lint.js"]));
			});
		});
	}
});

describe("carrier bins", () => {
	// silk is the one package a consumer installs, so it must OWN the `savvy` and
	// `savvy-mcp` bin entries: `node_modules/.bin/*` is created off the consumer's
	// single direct dependency, no hoisting required. Each bin is a shim over the
	// front end's `./main` export and imports NOTHING else — the shim files under
	// `src/bin/` are the one sanctioned place silk imports `@savvy-web/cli` / `@savvy-web/mcp`.
	const pkgDir = join(PKG_ROOT, "dist/dev/pkg");
	const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8")) as {
		bin?: Record<string, string>;
	};

	const shims = [
		{ command: "savvy", specifier: "@savvy-web/cli/main" },
		{ command: "savvy-mcp", specifier: "@savvy-web/mcp/main" },
	] as const;

	it("declares both bins in the built manifest", () => {
		expect(manifest.bin?.savvy).toBe("bin/savvy.js");
		expect(manifest.bin?.["savvy-mcp"]).toBe("bin/savvy-mcp.js");
	});

	for (const { command, specifier } of shims) {
		it(`${command} imports ${specifier} and nothing else`, () => {
			const binPath = manifest.bin?.[command];
			expect(binPath).toBeDefined();
			const source = readFileSync(join(pkgDir, binPath as string), "utf-8");
			expect(source.startsWith("#!/usr/bin/env node")).toBe(true);
			const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
			expect(specifiers).toEqual([specifier]);
			// The shim must CALL main, not merely import it. Anchored to a whole statement line so
			// the doc comment ("call the same `main()`") cannot satisfy it if the call is deleted.
			expect(source).toMatch(/^(?:await )?main\(\);$/m);
		});
	}
});
