import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Result } from "effect";
import { Changesets } from "../../src/index.js";
import { makeReleaseFixture, readFixtureChangelog } from "./support/release-fixture.js";

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

// ConfigInspectorLive needs real FS/discovery; for apply tests we provide a
// ConfigInspector stub with no versionFiles (the versionFiles path is covered
// by the dedicated versionFiles tests below). plan/apply use the real engine over the fixture.

function getPlanner(projectDir: string) {
	const InspectorStub = Changesets.makeConfigInspectorTest({
		configPath: join(projectDir, ".changeset/config.json"),
		projectDir,
		changelog: "@changesets/cli/changelog",
		baseBranch: "main",
		access: "restricted",
		ignore: [],
		packages: [],
		legacyVersionFilesUsed: false,
	});
	return Changesets.ReleasePlanner.pipe(
		Effect.provide(Changesets.ReleasePlannerLive),
		Effect.provide(InspectorStub),
		Effect.provide(NodeServices.layer),
	) as Effect.Effect<Changesets.ReleasePlannerShape>;
}

/**
 * Build a planner with a ConfigInspector scope that includes versionFiles
 * pointing at `targetFile` for the given `packageDir`. The scope's name and
 * version must be in sync with the fixture so plan lookups resolve correctly.
 */
function getPlannerWithVersionFiles(opts: {
	projectDir: string;
	pkgName: string;
	pkgVersion: string;
	pkgWorkspaceDir: string;
	targetFile: string;
}) {
	const { projectDir, pkgName, pkgVersion, pkgWorkspaceDir, targetFile } = opts;
	const InspectorStub = Changesets.makeConfigInspectorTest({
		configPath: join(projectDir, ".changeset/config.json"),
		projectDir,
		changelog: "@changesets/cli/changelog",
		baseBranch: "main",
		access: "restricted",
		ignore: [],
		packages: [
			{
				name: pkgName,
				workspaceDir: pkgWorkspaceDir,
				version: pkgVersion,
				additionalScopes: [],
				additionalScopeFiles: [],
				versionFiles: [
					{
						glob: "plugin.json",
						paths: ["$.version"],
						matchedFiles: [targetFile],
					},
				],
			},
		],
		legacyVersionFilesUsed: false,
	});
	return Changesets.ReleasePlanner.pipe(
		Effect.provide(Changesets.ReleasePlannerLive),
		Effect.provide(InspectorStub),
		Effect.provide(NodeServices.layer),
	) as Effect.Effect<Changesets.ReleasePlannerShape>;
}

describe("ReleasePlanner.apply (versionFiles)", () => {
	it.effect("dryRun reports the planned new version for versionFiles and does not update the target file on disk", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brave-lions-sing", releases: { "@scope/a": "minor" }, summary: "feat: vf test" }],
			});
			roots.push(root);

			// Write a plugin.json alongside the package that versionFiles will update.
			const pkgDir = join(root, "packages/a");
			const pluginJsonPath = join(pkgDir, "plugin.json");
			writeFileSync(pluginJsonPath, `${JSON.stringify({ version: "1.0.0" }, null, 2)}\n`, "utf-8");

			const planner = yield* getPlannerWithVersionFiles({
				projectDir: root,
				pkgName: "@scope/a",
				pkgVersion: "1.0.0",
				pkgWorkspaceDir: pkgDir,
				targetFile: pluginJsonPath,
			});

			const result = yield* planner.apply(root, { dryRun: true }) as Effect.Effect<Changesets.AppliedRelease>;

			// (a) dryRun: versionFileUpdates is non-empty and reports the NEW version (1.1.0)
			expect(result.versionFileUpdates).toHaveLength(1);
			expect(result.versionFileUpdates[0].filePath).toBe(pluginJsonPath);
			expect(result.versionFileUpdates[0].version).toBe("1.1.0");

			// (a) dryRun: the file on disk is still at 1.0.0 (not written)
			const diskContent = JSON.parse(readFileSync(pluginJsonPath, "utf-8")) as { version: string };
			expect(diskContent.version).toBe("1.0.0");
		}),
	);

	it.effect("non-dry apply updates the target file on disk to the new version", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brave-lions-sing", releases: { "@scope/a": "minor" }, summary: "feat: vf test" }],
			});
			roots.push(root);

			const pkgDir = join(root, "packages/a");
			const pluginJsonPath = join(pkgDir, "plugin.json");
			writeFileSync(pluginJsonPath, `${JSON.stringify({ version: "1.0.0" }, null, 2)}\n`, "utf-8");

			const planner = yield* getPlannerWithVersionFiles({
				projectDir: root,
				pkgName: "@scope/a",
				pkgVersion: "1.0.0",
				pkgWorkspaceDir: pkgDir,
				targetFile: pluginJsonPath,
			});

			const result = yield* planner.apply(root) as Effect.Effect<Changesets.AppliedRelease>;

			// (b) non-dry: versionFileUpdates reports the file at the new version
			expect(result.versionFileUpdates).toHaveLength(1);
			expect(result.versionFileUpdates[0].filePath).toBe(pluginJsonPath);
			expect(result.versionFileUpdates[0].version).toBe("1.1.0");

			// (b) non-dry: the file on disk is updated to 1.1.0
			const diskContent = JSON.parse(readFileSync(pluginJsonPath, "utf-8")) as { version: string };
			expect(diskContent.version).toBe("1.1.0");
		}),
	);

	it.effect("surfaces a versionFile write failure as a typed error, not an uncaught defect", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brave-lions-sing", releases: { "@scope/a": "minor" }, summary: "feat: vf test" }],
			});
			roots.push(root);

			// versionFiles points at a file that does not exist, so
			// processResolvedVersionFiles throws synchronously. That throw must surface
			// as a typed ReleasePlanError rather than an uncaught defect (which would
			// otherwise bypass the inspector catchAll and crash apply()).
			const planner = yield* getPlannerWithVersionFiles({
				projectDir: root,
				pkgName: "@scope/a",
				pkgVersion: "1.0.0",
				pkgWorkspaceDir: join(root, "packages/a"),
				targetFile: join(root, "packages/a", "missing.json"),
			});

			const exit = yield* Effect.exit(planner.apply(root, { dryRun: true }));
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.hasDies(exit.cause)).toBe(false);
				const failure = Cause.findFail(exit.cause);
				expect(Result.isSuccess(failure)).toBe(true);
				if (Result.isSuccess(failure)) {
					expect((failure.success.error as { _tag: string })._tag).toBe("ReleasePlanError");
				}
			}
		}),
	);
});

describe("ReleasePlanner.apply", () => {
	it.effect("dryRun reports releases and writes nothing", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brave-pandas-learn", releases: { "@scope/a": "minor" }, summary: "feat: thing" }],
			});
			roots.push(root);
			const planner = yield* getPlanner(root);
			const result = yield* planner.apply(root, { dryRun: true }) as Effect.Effect<Changesets.AppliedRelease>;
			expect(result.dryRun).toBe(true);
			expect(result.touchedFiles).toEqual([]);
			expect(result.releases).toEqual([{ name: "@scope/a", type: "minor", oldVersion: "1.0.0", newVersion: "1.1.0" }]);
			// nothing written
			expect(existsSync(join(root, "packages/a/CHANGELOG.md"))).toBe(false);
			expect(JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf-8")).version).toBe("1.0.0");
			expect(existsSync(join(root, ".changeset", "brave-pandas-learn.md"))).toBe(true);
		}),
	);

	it.effect("apply bumps versions, writes+transforms CHANGELOG, deletes changesets", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brave-pandas-learn", releases: { "@scope/a": "minor" }, summary: "feat: thing" }],
			});
			roots.push(root);
			const planner = yield* getPlanner(root);
			const result = yield* planner.apply(root) as Effect.Effect<Changesets.AppliedRelease>;
			expect(result.dryRun).toBe(false);
			expect(JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf-8")).version).toBe("1.1.0");
			const cl = readFileSync(join(root, "packages/a/CHANGELOG.md"), "utf-8");
			expect(cl).toContain("## 1.1.0");
			expect(existsSync(join(root, ".changeset", "brave-pandas-learn.md"))).toBe(false);
			expect(result.touchedFiles.some((f) => f.endsWith("CHANGELOG.md"))).toBe(true);
		}),
	);

	it.effect("writes a Maintenance note into the changelog of a fixed-group release with no changesets", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [
					{ dir: "packages/f1", name: "@scope/fixed-1", version: "2.3.0" },
					{ dir: "packages/f2", name: "@scope/fixed-2", version: "2.3.0" },
				],
				changesets: [{ id: "calm-owls-run", releases: { "@scope/fixed-2": "patch" }, summary: "fix: something" }],
				configExtra: { fixed: [["@scope/fixed-1", "@scope/fixed-2"]] },
			});
			roots.push(root);
			const planner = yield* getPlanner(root);
			yield* planner.apply(root);
			const changelog = readFixtureChangelog(root, "packages/f1");
			expect(changelog).toContain("## 2.3.1");
			expect(changelog).toContain("### Maintenance");
			expect(changelog).toContain("`@scope/fixed-2@2.3.1`");
			expect(changelog).toContain("(fixed version group)");
			// the mover's own changelog gets no note
			expect(readFixtureChangelog(root, "packages/f2")).not.toContain("### Maintenance");
		}),
	);
});

describe("ReleasePlanner.apply changelogModules", () => {
	it.effect("rewrites a mapped changelog id to the module path and applies", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "calm-owls-run", releases: { "@scope/a": "minor" }, summary: "feat: mapped changelog" }],
			});
			roots.push(root);
			// Fixture config names a package that is NOT installed anywhere.
			const configPath = join(root, ".changeset/config.json");
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			config.changelog = ["@savvy-web/not-installed/changelog", { repo: "o/r" }];
			writeFileSync(configPath, JSON.stringify(config, null, 2));
			// A real module file the map points at.
			const modPath = join(root, "mapped-changelog.mjs");
			writeFileSync(
				modPath,
				"export default {\n" +
					// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional plain string containing literal backtick-quoted JS source, not a template literal.
					"  getReleaseLine: async (cs) => `- mapped: ${cs.summary}`,\n" +
					'  getDependencyReleaseLine: async () => "",\n' +
					"};\n",
			);

			const planner = yield* getPlanner(root);
			const result = yield* planner.apply(root, {
				changelogModules: { "@savvy-web/not-installed/changelog": modPath },
			});

			expect(result.releases[0].newVersion).toBe("1.1.0");
			const changelog = readFixtureChangelog(root, "packages/a");
			expect(changelog).toContain("mapped: feat: mapped changelog");
		}),
	);

	it.effect("fails with a typed error naming an unmapped id", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brisk-ants-march", releases: { "@scope/a": "patch" }, summary: "fix: unmapped" }],
			});
			roots.push(root);
			const configPath = join(root, ".changeset/config.json");
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			config.changelog = ["@custom/generator", null];
			writeFileSync(configPath, JSON.stringify(config, null, 2));

			const planner = yield* getPlanner(root);
			const exit = yield* Effect.exit(
				planner.apply(root, { changelogModules: { "@savvy-web/changelog": "/tmp/nope.mjs" } }),
			);

			expect(Exit.isFailure(exit)).toBe(true);
			const message = Cause.pretty(Exit.isFailure(exit) ? exit.cause : Cause.empty);
			expect(message).toContain("@custom/generator");
			expect(message).toContain("@savvy-web/changelog");
		}),
	);
});
