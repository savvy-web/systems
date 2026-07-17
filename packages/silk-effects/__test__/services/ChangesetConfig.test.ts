/**
 * Unit tests for ChangesetConfig service.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChangesetConfig, ChangesetConfigLive } from "../../src/services/ChangesetConfig.js";
import { ChangesetConfigReaderLive } from "../../src/services/ChangesetConfigReader.js";

const writeConfig = (dir: string, content: unknown): void => {
	const cd = join(dir, ".changeset");
	mkdirSync(cd, { recursive: true });
	writeFileSync(join(cd, "config.json"), JSON.stringify(content), "utf-8");
};

const run = <A, E>(eff: Effect.Effect<A, E, ChangesetConfig>): Promise<A> =>
	Effect.runPromise(
		eff.pipe(
			Effect.provide(ChangesetConfigLive),
			Effect.provide(ChangesetConfigReaderLive),
			Effect.provide(NodeServices.layer),
		),
	);

describe("ChangesetConfig", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "ccfg-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns 'none' when .changeset/config.json does not exist", async () => {
		const mode = await run(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
		expect(mode).toBe("none");
	});

	it("returns 'silk' when changelog is a string starting with @savvy-web/changesets", async () => {
		writeConfig(tmpDir, { changelog: "@savvy-web/changesets/changelog" });
		const mode = await run(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
		expect(mode).toBe("silk");
	});

	it("returns 'silk' when changelog[0] is a string starting with @savvy-web/changesets", async () => {
		writeConfig(tmpDir, { changelog: ["@savvy-web/changesets/changelog", { repo: "x/y" }] });
		const mode = await run(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
		expect(mode).toBe("silk");
	});

	it("returns 'vanilla' when changelog is a different string", async () => {
		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog" });
		const mode = await run(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
		expect(mode).toBe("vanilla");
	});

	it("returns 'vanilla' when changelog field is absent", async () => {
		writeConfig(tmpDir, {});
		const mode = await run(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
		expect(mode).toBe("vanilla");
	});

	it("returns 'none' on malformed JSON", async () => {
		mkdirSync(join(tmpDir, ".changeset"), { recursive: true });
		writeFileSync(join(tmpDir, ".changeset", "config.json"), "{ not valid json", "utf-8");
		const mode = await run(Effect.flatMap(ChangesetConfig, (c) => c.mode(tmpDir)));
		expect(mode).toBe("none");
	});

	it("versionPrivate returns true when privatePackages.version is true", async () => {
		writeConfig(tmpDir, { privatePackages: { version: true } });
		const v = await run(Effect.flatMap(ChangesetConfig, (c) => c.versionPrivate(tmpDir)));
		expect(v).toBe(true);
	});

	it("versionPrivate returns false when missing", async () => {
		writeConfig(tmpDir, {});
		const v = await run(Effect.flatMap(ChangesetConfig, (c) => c.versionPrivate(tmpDir)));
		expect(v).toBe(false);
	});

	it("versionPrivate returns false when config does not exist", async () => {
		const v = await run(Effect.flatMap(ChangesetConfig, (c) => c.versionPrivate(tmpDir)));
		expect(v).toBe(false);
	});
});

describe("ChangesetConfig.isIgnored / ignorePatterns", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "cc-ignore-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns the configured ignore patterns", async () => {
		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*", "@rspress/*"] });
		const patterns = await run(Effect.flatMap(ChangesetConfig, (c) => c.ignorePatterns(tmpDir)));
		expect(patterns).toEqual(["@libraries/*", "@rspress/*"]);
	});

	it("isIgnored matches scope wildcards", async () => {
		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*"] });
		const ignored = await run(Effect.flatMap(ChangesetConfig, (c) => c.isIgnored("@libraries/multi-entry", tmpDir)));
		expect(ignored).toBe(true);
	});

	it("isIgnored is false for a package not in the ignore list", async () => {
		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*"] });
		const ignored = await run(Effect.flatMap(ChangesetConfig, (c) => c.isIgnored("@savvy-web/rslib-builder", tmpDir)));
		expect(ignored).toBe(false);
	});

	it("isIgnored is false when no ignore list is present", async () => {
		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog" });
		const ignored = await run(Effect.flatMap(ChangesetConfig, (c) => c.isIgnored("@libraries/x", tmpDir)));
		expect(ignored).toBe(false);
	});
});

describe("ChangesetConfig.refresh (#229 — long-lived process staleness)", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "cc-refresh-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("without refresh, a second read in the same runtime still serves the cached (stale) ignore list", async () => {
		const program = Effect.gen(function* () {
			const config = yield* ChangesetConfig;
			const before = yield* config.isIgnored("@libraries/x", tmpDir);

			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*"] });
			const stillCached = yield* config.isIgnored("@libraries/x", tmpDir);
			return { before, stillCached };
		});

		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: [] });
		const { before, stillCached } = await run(program);
		expect(before).toBe(false);
		expect(stillCached).toBe(false);
	});

	it("after refresh(), a read reflects an on-disk edit made since the last read in the same runtime", async () => {
		const program = Effect.gen(function* () {
			const config = yield* ChangesetConfig;
			const before = yield* config.isIgnored("@libraries/x", tmpDir);

			writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: ["@libraries/*"] });
			yield* config.refresh();
			const after = yield* config.isIgnored("@libraries/x", tmpDir);
			return { before, after };
		});

		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", ignore: [] });
		const { before, after } = await run(program);
		expect(before).toBe(false);
		expect(after).toBe(true);
	});
});

describe("ChangesetConfig.fixed", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "cc-fixed-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns the configured fixed groups", async () => {
		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog", fixed: [["@org/a", "@org/b"]] });
		const fixed = await run(Effect.flatMap(ChangesetConfig, (c) => c.fixed(tmpDir)));
		expect(fixed).toEqual([["@org/a", "@org/b"]]);
	});

	it("returns [] when fixed is absent", async () => {
		writeConfig(tmpDir, { changelog: "@changesets/cli/changelog" });
		const fixed = await run(Effect.flatMap(ChangesetConfig, (c) => c.fixed(tmpDir)));
		expect(fixed).toEqual([]);
	});
});
