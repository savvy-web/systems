/**
 * Proves the carrier pattern from OUTSIDE the workspace: a scratch project
 * whose only direct dependency is a packed `@savvy-web/silk` tarball ends up
 * with `node_modules/.bin/savvy` and `node_modules/.bin/savvy-mcp`, and both
 * run — under pnpm and under npm, with no hoisting help of any kind (no
 * `publicHoistPattern`, no `.npmrc`, no pnpm config dependency).
 *
 * @remarks
 * The five companions silk exact-pins (`cli`, `mcp`, `changelog`,
 * `silk-effects`, `silk-core`) are unpublished at the versions on this branch,
 * so the scratch project maps each name to its local tarball through the
 * package manager's `overrides`. Everything else — `effect`, the `@effected`
 * kit, the peers — comes from the registry, which is why these tests need the
 * network and are slow. They live in `@e2e/silk` so the root config serialises
 * them.
 */

import { execFileSync } from "node:child_process";
import {
	accessSync,
	constants,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { AppPackage } from "./helpers.js";
import {
	APP_PACKAGES,
	SPAWN_ENV,
	hasBinary,
	initializeRequest,
	installedVersions,
	packAll,
	runBin,
	tarballManifest,
} from "./helpers.js";

type PackageManager = "pnpm" | "npm";

const INSTALL_TIMEOUT_MS = 240_000;

/** Shim -> node -> the front end's import graph; the 5 s default is tight on CI. */
const BIN_TIMEOUT_MS = 30_000;

/**
 * pnpm 11 exits non-zero on an install that IGNORED a dependency build script
 * (`ERR_PNPM_IGNORED_BUILDS`, here esbuild's optional postinstall) unless
 * `strictDepBuilds` is off. That is a supply-chain posture, not a hoisting
 * setting, so it is passed on the command line rather than written into the
 * scratch project's config.
 */
const INSTALL_ARGS: Record<PackageManager, ReadonlyArray<string>> = {
	pnpm: ["install", "--config.strict-dep-builds=false"],
	npm: ["install"],
};

// realpath'd so the `file:` specs and the install cwd agree even when the OS
// tmpdir is a symlink (macOS `/var` -> `/private/var`); otherwise pnpm records
// the tarballs under a `../../../../private/var/...` relative path.
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "silk-packed-install-")));
const tarballDir = join(scratch, "tarballs");
let tarballs: Record<AppPackage, string>;

beforeAll(() => {
	tarballs = packAll(tarballDir);
}, 120_000);

afterAll(() => {
	rmSync(scratch, { recursive: true, force: true });
});

describe("packed tarballs", () => {
	it("pnpm pack rewrote every workspace:/catalog: specifier to a concrete range", () => {
		for (const name of APP_PACKAGES) {
			const manifest = tarballManifest(tarballs[name]);
			const json = JSON.stringify(manifest);
			expect(json, `${name} manifest`).not.toContain("workspace:");
			expect(json, `${name} manifest`).not.toContain("catalog:");
			expect(manifest.name).toBe(name);
			expect(manifest.private).toBe(false);
		}
	});

	it("silk's tarball pins its five companions to the exact versions packed beside it", () => {
		const silk = tarballManifest(tarballs["@savvy-web/silk"]);
		const deps = silk.dependencies as Record<string, string>;
		for (const name of [
			"@savvy-web/cli",
			"@savvy-web/mcp",
			"@savvy-web/changelog",
			"@savvy-web/silk-effects",
		] as const) {
			const packed = tarballManifest(tarballs[name]).version;
			expect(deps[name], `${name} pin`).toBe(packed);
		}
		expect(silk.bin).toEqual({ savvy: "bin/savvy.js", "savvy-mcp": "bin/savvy-mcp.js" });
	});
});

const file = (name: AppPackage) => `file:${join(tarballDir, basename(tarballs[name]))}`;

/** name -> `file:` tarball for the five companions silk exact-pins. */
const companionOverrides = () =>
	Object.fromEntries(APP_PACKAGES.filter((name) => name !== "@savvy-web/silk").map((name) => [name, file(name)]));

/**
 * Write the scratch consumer for `pm`. The ONLY dependency is the silk
 * tarball; the companions are steered to their local tarballs through
 * `overrides`. npm reads them from the manifest; pnpm 11 no longer reads a
 * `pnpm` field in package.json, so its overrides go in a `pnpm-workspace.yaml`
 * that carries NOTHING else — no hoist pattern, no `configDependencies`, no
 * `.npmrc`.
 */
const writeScratchProject = (pm: PackageManager, projectDir: string): void => {
	mkdirSync(projectDir, { recursive: true });
	const overrides = companionOverrides();
	const manifest = {
		name: `scratch-${pm}`,
		version: "0.0.0",
		private: true,
		type: "module",
		devDependencies: { "@savvy-web/silk": file("@savvy-web/silk") },
		...(pm === "npm" ? { overrides } : {}),
	};
	writeFileSync(join(projectDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
	if (pm === "pnpm") {
		const yaml = Object.entries(overrides)
			.map(([name, spec]) => `  "${name}": "${spec}"`)
			.join("\n");
		writeFileSync(join(projectDir, "pnpm-workspace.yaml"), `overrides:\n${yaml}\n`);
	}
};

describe.each<PackageManager>(["pnpm", "npm"])("%s install of the silk tarball outside the workspace", (pm) => {
	const available = hasBinary(pm);
	const projectDir = join(scratch, `${pm}-project`);
	const binDir = join(projectDir, "node_modules", ".bin");
	let installMs = 0;

	beforeAll(() => {
		if (!available) return;
		writeScratchProject(pm, projectDir);
		const started = performance.now();
		execFileSync(pm, [...INSTALL_ARGS[pm]], {
			cwd: projectDir,
			env: SPAWN_ENV,
			stdio: "pipe",
			timeout: INSTALL_TIMEOUT_MS,
		});
		installMs = Math.round(performance.now() - started);
	}, INSTALL_TIMEOUT_MS + 10_000);

	it.skipIf(!available)("installs with no hoisting configuration of any kind", () => {
		const entries = readdirSync(projectDir);
		expect(entries, "no .npmrc in the scratch project").not.toContain(".npmrc");
		// Every config file the project has, concatenated: the only setting anywhere is `overrides`.
		const config = ["package.json", "pnpm-workspace.yaml"]
			.filter((f) => entries.includes(f))
			.map((f) => readFileSync(join(projectDir, f), "utf8"))
			.join("\n");
		for (const forbidden of [
			"publicHoistPattern",
			"public-hoist-pattern",
			"hoistPattern",
			"configDependencies",
			"shamefully",
		]) {
			expect(config, `no ${forbidden} in the scratch project config`).not.toContain(forbidden);
		}
		expect(existsSync(join(projectDir, "node_modules", "@savvy-web", "pnpm-plugin-silk"))).toBe(false);
		expect(installMs, `${pm} install took ${installMs}ms`).toBeGreaterThan(0);
	});

	it.skipIf(!available)("exposes both carrier bins in node_modules/.bin, executable", () => {
		for (const bin of ["savvy", "savvy-mcp"]) {
			const p = join(binDir, bin);
			expect(existsSync(p), `${p} exists`).toBe(true);
			expect(() => accessSync(p, constants.X_OK), `${p} is executable`).not.toThrow();
			// npm links `.bin` entries to the JS file; whichever @savvy-web mirror of the
			// bin won the flat hoist, it must be one INSIDE this scratch project's tree.
			if (pm === "npm") {
				const scope = `${join(realpathSync(projectDir), "node_modules", "@savvy-web")}/`;
				expect(realpathSync(p).startsWith(scope), `${bin} resolves inside ${scope}`).toBe(true);
			}
		}
	});

	// pnpm's isolated layout is the strong form of the carrier claim: silk is the
	// ONLY package under node_modules/@savvy-web, and both shims target silk's
	// own bin files. npm hoists the whole graph flat, and since cli/mcp declare
	// the same bin names their JS may win the `.bin` link — the bins still come
	// off the single silk dependency, but which package's shim wins is npm's call.
	it.skipIf(!available || pm !== "pnpm")(
		"links both .bin entries to silk's own bin files, with silk the only top-level @savvy-web package",
		() => {
			expect(readdirSync(join(projectDir, "node_modules", "@savvy-web"))).toEqual(["silk"]);
			for (const bin of ["savvy", "savvy-mcp"]) {
				const shim = readFileSync(join(binDir, bin), "utf8");
				expect(shim, `${bin} shim target`).toContain(`/@savvy-web/silk/bin/${bin}.js`);
			}
		},
	);

	it.skipIf(!available)("resolved the exact-pinned companions to the local tarballs", () => {
		const installed = installedVersions(projectDir);
		for (const name of APP_PACKAGES) {
			const expected = tarballManifest(tarballs[name]).version;
			expect(installed[name], `${name} version`).toBe(expected);
		}
		// The lockfile, not just the resolved version, must record each companion as
		// a `file:` tarball — a same-version registry hit would pass the check above.
		const lockfile = readFileSync(join(projectDir, pm === "pnpm" ? "pnpm-lock.yaml" : "package-lock.json"), "utf8");
		for (const name of APP_PACKAGES) {
			const tarball = basename(tarballs[name]).replaceAll(".", "\\.");
			expect(lockfile, `${name} recorded as file: in the ${pm} lockfile`).toMatch(
				new RegExp(`file:[^\\s'"(),]*/${tarball}`),
			);
		}
	});

	it.effect.skipIf(!available)(
		"savvy runs from .bin and reports a version",
		() =>
			Effect.gen(function* () {
				const result = yield* runBin(projectDir, join(binDir, "savvy"), ["--version"]);
				assert.match(result.stdout.trim(), /^savvy v\d+\.\d+\.\d+/);
				assert.strictEqual(result.exitCode, 0);
			}).pipe(Effect.provide(NodeServices.layer)),
		BIN_TIMEOUT_MS,
	);

	it.effect.skipIf(!available)(
		"savvy-mcp runs from .bin: initialize on stdout, silent stderr, exit 0",
		() =>
			Effect.gen(function* () {
				const result = yield* runBin(projectDir, join(binDir, "savvy-mcp"), [], initializeRequest);
				assert.include(result.stdout, '"jsonrpc":"2.0"');
				assert.include(result.stdout, '"serverInfo"');
				assert.strictEqual(result.stderr, "");
				assert.strictEqual(result.exitCode, 0);
			}).pipe(Effect.provide(NodeServices.layer)),
		BIN_TIMEOUT_MS,
	);
});
