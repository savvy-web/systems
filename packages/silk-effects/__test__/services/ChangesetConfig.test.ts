/**
 * Unit tests for ChangesetConfig service.
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, FileSystem } from "effect";
import { ChangesetConfig } from "../../src/services/ChangesetConfig.js";
import { ChangesetConfigReader } from "../../src/services/ChangesetConfigReader.js";

/**
 * A fixed project root on the virtual volume, replacing a per-test `mkdtempSync`.
 * `ChangesetConfig` caches per root, so the roots still have to differ between the
 * suites that pin cache lifetime — hence a constant per `describe`, not one global.
 */
const configPath = (root: string) => `${root}/.changeset/config.json`;

/**
 * The seed the next `provide` will build its volume from. `writeConfig` stages an
 * entry here rather than touching a disk, so every call site below is unchanged:
 * `provide` reads this record when it constructs the layer, which happens after
 * the staging call. A write made *inside* a running program cannot go through
 * here — the volume is already built — and must use `writeConfigLive` instead.
 */
let files: Record<string, string>;

const writeConfig = (dir: string, content: unknown): void => {
	files[configPath(dir)] = JSON.stringify(content);
};

/** Write the config through the SAME filesystem the service reads, mid-runtime. */
const writeConfigLive = (dir: string, content: unknown) =>
	Effect.flatMap(FileSystem.FileSystem, (fs) => fs.writeFileString(configPath(dir), JSON.stringify(content)));

/**
 * Provide the config graph PER TEST rather than at the suite boundary.
 *
 * This is deliberate and must not be "optimised" into a `layer(...)` block:
 * `ChangesetConfig` holds a never-self-expiring per-root cache, and the
 * `refresh` tests below pin what a second read sees *within one runtime*. A
 * suite-boundary layer is built once for the whole group, which would share
 * that cache across every test and dissolve the very lifetime boundary those
 * tests exist to pin.
 *
 * One `Effect.provide` of the volume serves both the service graph beneath it
 * and any `writeConfigLive` in the program above it, so both see one volume —
 * layer memoization is per build, not per layer value.
 */
const provide = <A, E>(eff: Effect.Effect<A, E, ChangesetConfig | FileSystem.FileSystem>): Effect.Effect<A, E> =>
	eff.pipe(
		Effect.provide(ChangesetConfig.layer),
		Effect.provide(ChangesetConfigReader.layer),
		Effect.provide(MemoryFileSystem.layerWith(files)),
	);

describe("ChangesetConfig", () => {
	const tmpDir = "/ccfg";
	beforeEach(() => {
		files = {};
	});

	it.effect("returns 'none' when .changeset/config.json does not exist", () =>
		Effect.gen(function* () {
			const mode = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
			expect(mode).toBe("none");
		}),
	);

	it.effect("returns 'silk' when changelog is a string starting with @savvy-web/changesets", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: "@savvy-web/changesets/changelog" });
			const mode = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
			expect(mode).toBe("silk");
		}),
	);

	it.effect("returns 'silk' when changelog[0] is a string starting with @savvy-web/changesets", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: ["@savvy-web/changesets/changelog", { repo: "x/y" }] });
			const mode = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
			expect(mode).toBe("silk");
		}),
	);

	it.effect("returns 'vanilla' when changelog is a different string", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog" });
			const mode = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
			expect(mode).toBe("vanilla");
		}),
	);

	it.effect("returns 'vanilla' when changelog field is absent", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, {});
			const mode = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
			expect(mode).toBe("vanilla");
		}),
	);

	it.effect("returns 'none' on malformed JSON", () =>
		Effect.gen(function* () {
			// Seeded raw: `writeConfig` JSON-encodes, and this case needs bytes that do not parse.
			files[configPath(tmpDir)] = "{ not valid json";
			const mode = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
			expect(mode).toBe("none");
		}),
	);

	it.effect("versionPrivate returns true when privatePackages.version is true", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { privatePackages: { version: true } });
			const v = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.versionPrivate(tmpDir)));
			expect(v).toBe(true);
		}),
	);

	it.effect("versionPrivate returns false when missing", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, {});
			const v = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.versionPrivate(tmpDir)));
			expect(v).toBe(false);
		}),
	);

	it.effect("versionPrivate returns false when config does not exist", () =>
		Effect.gen(function* () {
			const v = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.versionPrivate(tmpDir)));
			expect(v).toBe(false);
		}),
	);
});

describe("ChangesetConfig.isIgnored / ignorePatterns", () => {
	const tmpDir = "/cc-ignore";
	beforeEach(() => {
		files = {};
	});

	it.effect("returns the configured ignore patterns", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*", "@rspress/*"] });
			const patterns = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.ignorePatterns(tmpDir)));
			expect(patterns).toEqual(["@libraries/*", "@rspress/*"]);
		}),
	);

	it.effect("isIgnored matches scope wildcards", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*"] });
			const ignored = yield* provide(
				Effect.flatMap(ChangesetConfig, (c) => c.isIgnored("@libraries/multi-entry", tmpDir)),
			);
			expect(ignored).toBe(true);
		}),
	);

	it.effect("isIgnored is false for a package not in the ignore list", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*"] });
			const ignored = yield* provide(
				Effect.flatMap(ChangesetConfig, (c) => c.isIgnored("@savvy-web/rslib-builder", tmpDir)),
			);
			expect(ignored).toBe(false);
		}),
	);

	it.effect("isIgnored is false when no ignore list is present", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog" });
			const ignored = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.isIgnored("@libraries/x", tmpDir)));
			expect(ignored).toBe(false);
		}),
	);
});

describe("ChangesetConfig.refresh (#229 — long-lived process staleness)", () => {
	const tmpDir = "/cc-refresh";
	beforeEach(() => {
		files = {};
	});

	it.effect("without refresh, a second read in the same runtime still serves the cached (stale) ignore list", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const config = yield* ChangesetConfig;
				const before = yield* config.isIgnored("@libraries/x", tmpDir);

				yield* writeConfigLive(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*"] });
				const stillCached = yield* config.isIgnored("@libraries/x", tmpDir);
				return { before, stillCached };
			});

			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: [] });
			const { before, stillCached } = yield* provide(program);
			expect(before).toBe(false);
			expect(stillCached).toBe(false);
		}),
	);

	it.effect("after refresh(), a read reflects an on-disk edit made since the last read in the same runtime", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const config = yield* ChangesetConfig;
				const before = yield* config.isIgnored("@libraries/x", tmpDir);

				yield* writeConfigLive(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*"] });
				yield* config.refresh();
				const after = yield* config.isIgnored("@libraries/x", tmpDir);
				return { before, after };
			});

			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: [] });
			const { before, after } = yield* provide(program);
			expect(before).toBe(false);
			expect(after).toBe(true);
		}),
	);
});

describe("ChangesetConfig.fixed", () => {
	const tmpDir = "/cc-fixed";
	beforeEach(() => {
		files = {};
	});

	it.effect("returns the configured fixed groups", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", fixed: [["@org/a", "@org/b"]] });
			const fixed = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.fixed(tmpDir)));
			expect(fixed).toEqual([["@org/a", "@org/b"]]);
		}),
	);

	it.effect("returns [] when fixed is absent", () =>
		Effect.gen(function* () {
			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog" });
			const fixed = yield* provide(Effect.flatMap(ChangesetConfig, (c) => c.fixed(tmpDir)));
			expect(fixed).toEqual([]);
		}),
	);
});
