import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { Changesets } from "../../src/index.js";
import { makeReleaseFixture, readFixtureChangelog } from "./fixtures/release-fixture.js";

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

// ConfigInspectorLive needs real FS/discovery; for apply tests we provide a
// ConfigInspector stub with no versionFiles (the versionFiles path is covered
// by the dedicated versionFiles tests below). plan/apply use the real engine over the fixture.

async function getPlanner(projectDir: string) {
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
	return Effect.runPromise(
		Changesets.ReleasePlanner.pipe(
			Effect.provide(Changesets.ReleasePlannerLive),
			Effect.provide(InspectorStub),
			Effect.provide(NodeContext.layer),
		) as Effect.Effect<Changesets.ReleasePlannerShape>,
	);
}

/**
 * Build a planner with a ConfigInspector scope that includes versionFiles
 * pointing at `targetFile` for the given `packageDir`. The scope's name and
 * version must be in sync with the fixture so plan lookups resolve correctly.
 */
async function getPlannerWithVersionFiles(opts: {
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
	return Effect.runPromise(
		Changesets.ReleasePlanner.pipe(
			Effect.provide(Changesets.ReleasePlannerLive),
			Effect.provide(InspectorStub),
			Effect.provide(NodeContext.layer),
		) as Effect.Effect<Changesets.ReleasePlannerShape>,
	);
}

describe("ReleasePlanner.apply (versionFiles)", () => {
	it("dryRun reports the planned new version for versionFiles and does not update the target file on disk", async () => {
		const root = makeReleaseFixture({
			packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
			changesets: [{ id: "brave-lions-sing", releases: { "@scope/a": "minor" }, summary: "feat: vf test" }],
		});
		roots.push(root);

		// Write a plugin.json alongside the package that versionFiles will update.
		const pkgDir = join(root, "packages/a");
		const pluginJsonPath = join(pkgDir, "plugin.json");
		writeFileSync(pluginJsonPath, `${JSON.stringify({ version: "1.0.0" }, null, 2)}\n`, "utf-8");

		const planner = await getPlannerWithVersionFiles({
			projectDir: root,
			pkgName: "@scope/a",
			pkgVersion: "1.0.0",
			pkgWorkspaceDir: pkgDir,
			targetFile: pluginJsonPath,
		});

		const result = await Effect.runPromise(
			planner.apply(root, { dryRun: true }) as Effect.Effect<Changesets.AppliedRelease>,
		);

		// (a) dryRun: versionFileUpdates is non-empty and reports the NEW version (1.1.0)
		expect(result.versionFileUpdates).toHaveLength(1);
		expect(result.versionFileUpdates[0].filePath).toBe(pluginJsonPath);
		expect(result.versionFileUpdates[0].version).toBe("1.1.0");

		// (a) dryRun: the file on disk is still at 1.0.0 (not written)
		const diskContent = JSON.parse(readFileSync(pluginJsonPath, "utf-8")) as { version: string };
		expect(diskContent.version).toBe("1.0.0");
	});

	it("non-dry apply updates the target file on disk to the new version", async () => {
		const root = makeReleaseFixture({
			packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
			changesets: [{ id: "brave-lions-sing", releases: { "@scope/a": "minor" }, summary: "feat: vf test" }],
		});
		roots.push(root);

		const pkgDir = join(root, "packages/a");
		const pluginJsonPath = join(pkgDir, "plugin.json");
		writeFileSync(pluginJsonPath, `${JSON.stringify({ version: "1.0.0" }, null, 2)}\n`, "utf-8");

		const planner = await getPlannerWithVersionFiles({
			projectDir: root,
			pkgName: "@scope/a",
			pkgVersion: "1.0.0",
			pkgWorkspaceDir: pkgDir,
			targetFile: pluginJsonPath,
		});

		const result = await Effect.runPromise(planner.apply(root) as Effect.Effect<Changesets.AppliedRelease>);

		// (b) non-dry: versionFileUpdates reports the file at the new version
		expect(result.versionFileUpdates).toHaveLength(1);
		expect(result.versionFileUpdates[0].filePath).toBe(pluginJsonPath);
		expect(result.versionFileUpdates[0].version).toBe("1.1.0");

		// (b) non-dry: the file on disk is updated to 1.1.0
		const diskContent = JSON.parse(readFileSync(pluginJsonPath, "utf-8")) as { version: string };
		expect(diskContent.version).toBe("1.1.0");
	});

	it("surfaces a versionFile write failure as a typed error, not an uncaught defect", async () => {
		const root = makeReleaseFixture({
			packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
			changesets: [{ id: "brave-lions-sing", releases: { "@scope/a": "minor" }, summary: "feat: vf test" }],
		});
		roots.push(root);

		// versionFiles points at a file that does not exist, so
		// processResolvedVersionFiles throws synchronously. That throw must surface
		// as a typed ReleasePlanError rather than an uncaught defect (which would
		// otherwise bypass the inspector catchAll and crash apply()).
		const planner = await getPlannerWithVersionFiles({
			projectDir: root,
			pkgName: "@scope/a",
			pkgVersion: "1.0.0",
			pkgWorkspaceDir: join(root, "packages/a"),
			targetFile: join(root, "packages/a", "missing.json"),
		});

		const exit = await Effect.runPromiseExit(planner.apply(root, { dryRun: true }));
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.isDie(exit.cause)).toBe(false);
			const failure = Cause.failureOption(exit.cause);
			expect(failure._tag).toBe("Some");
			if (failure._tag === "Some") {
				expect((failure.value as { _tag: string })._tag).toBe("ReleasePlanError");
			}
		}
	});
});

describe("ReleasePlanner.apply", () => {
	it("dryRun reports releases and writes nothing", async () => {
		const root = makeReleaseFixture({
			packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
			changesets: [{ id: "brave-pandas-learn", releases: { "@scope/a": "minor" }, summary: "feat: thing" }],
		});
		roots.push(root);
		const planner = await getPlanner(root);
		const result = await Effect.runPromise(
			planner.apply(root, { dryRun: true }) as Effect.Effect<Changesets.AppliedRelease>,
		);
		expect(result.dryRun).toBe(true);
		expect(result.touchedFiles).toEqual([]);
		expect(result.releases).toEqual([{ name: "@scope/a", type: "minor", oldVersion: "1.0.0", newVersion: "1.1.0" }]);
		// nothing written
		expect(existsSync(join(root, "packages/a/CHANGELOG.md"))).toBe(false);
		expect(JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf-8")).version).toBe("1.0.0");
		expect(existsSync(join(root, ".changeset", "brave-pandas-learn.md"))).toBe(true);
	});

	it("apply bumps versions, writes+transforms CHANGELOG, deletes changesets", async () => {
		const root = makeReleaseFixture({
			packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
			changesets: [{ id: "brave-pandas-learn", releases: { "@scope/a": "minor" }, summary: "feat: thing" }],
		});
		roots.push(root);
		const planner = await getPlanner(root);
		const result = await Effect.runPromise(planner.apply(root) as Effect.Effect<Changesets.AppliedRelease>);
		expect(result.dryRun).toBe(false);
		expect(JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf-8")).version).toBe("1.1.0");
		const cl = readFileSync(join(root, "packages/a/CHANGELOG.md"), "utf-8");
		expect(cl).toContain("## 1.1.0");
		expect(existsSync(join(root, ".changeset", "brave-pandas-learn.md"))).toBe(false);
		expect(result.touchedFiles.some((f) => f.endsWith("CHANGELOG.md"))).toBe(true);
	});

	it("writes a Maintenance note into the changelog of a fixed-group release with no changesets", async () => {
		const root = makeReleaseFixture({
			packages: [
				{ dir: "packages/f1", name: "@scope/fixed-1", version: "2.3.0" },
				{ dir: "packages/f2", name: "@scope/fixed-2", version: "2.3.0" },
			],
			changesets: [{ id: "calm-owls-run", releases: { "@scope/fixed-2": "patch" }, summary: "fix: something" }],
			configExtra: { fixed: [["@scope/fixed-1", "@scope/fixed-2"]] },
		});
		roots.push(root);
		const planner = await getPlanner(root);
		await Effect.runPromise(planner.apply(root));
		const changelog = readFixtureChangelog(root, "packages/f1");
		expect(changelog).toContain("## 2.3.1");
		expect(changelog).toContain("### Maintenance");
		expect(changelog).toContain("`@scope/fixed-2@2.3.1`");
		expect(changelog).toContain("(fixed version group)");
		// the mover's own changelog gets no note
		expect(readFixtureChangelog(root, "packages/f2")).not.toContain("### Maintenance");
	});
});

describe("ReleasePlanner.apply changelogModules", () => {
	it("rewrites a mapped changelog id to the module path and applies", async () => {
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
				"  getReleaseLine: async (cs) => `- mapped: ${cs.summary}`,\n" +
				'  getDependencyReleaseLine: async () => "",\n' +
				"};\n",
		);

		const planner = await getPlanner(root);
		const result = await Effect.runPromise(
			planner.apply(root, { changelogModules: { "@savvy-web/not-installed/changelog": modPath } }),
		);

		expect(result.releases[0].newVersion).toBe("1.1.0");
		const changelog = readFixtureChangelog(root, "packages/a");
		expect(changelog).toContain("mapped: feat: mapped changelog");
	});

	it("fails with a typed error naming an unmapped id", async () => {
		const root = makeReleaseFixture({
			packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
			changesets: [{ id: "brisk-ants-march", releases: { "@scope/a": "patch" }, summary: "fix: unmapped" }],
		});
		roots.push(root);
		const configPath = join(root, ".changeset/config.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		config.changelog = ["@custom/generator", null];
		writeFileSync(configPath, JSON.stringify(config, null, 2));

		const planner = await getPlanner(root);
		const exit = await Effect.runPromiseExit(
			planner.apply(root, { changelogModules: { "@savvy-web/changelog": "/tmp/nope.mjs" } }),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		const message = Cause.pretty(Exit.isFailure(exit) ? exit.cause : Cause.empty);
		expect(message).toContain("@custom/generator");
		expect(message).toContain("@savvy-web/changelog");
	});
});
