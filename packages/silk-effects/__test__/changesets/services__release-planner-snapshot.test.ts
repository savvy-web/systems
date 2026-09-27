import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import { Changesets } from "../../src/index.js";
import { makeReleaseFixture } from "./support/release-fixture.js";

// Derive the monorepo node_modules from this test file's location so
// `@changesets/cli/changelog` resolves from inside the fixture root, the same
// way services__release-planner-preview.test.ts does.
const repoNodeModules = join(fileURLToPath(import.meta.url), "..", "..", "..", "..", "..", "node_modules");

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

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
		Effect.provide(Changesets.ReleasePlanner.layer),
		Effect.provide(InspectorStub),
		Effect.provide(NodeServices.layer),
	) as Effect.Effect<Changesets.ReleasePlannerShape>;
}

describe("ReleasePlanner.apply (snapshot)", () => {
	it.effect(
		"applies a calculated snapshot version, exact-pins the dependent package, writes CHANGELOG, deletes the changeset",
		() =>
			Effect.gen(function* () {
				const root = makeReleaseFixture({
					packages: [
						{
							dir: "packages/a",
							name: "@scope/a",
							version: "1.0.0",
							extra: { dependencies: { "@scope/b": "^0.1.0" } },
						},
						{ dir: "packages/b", name: "@scope/b", version: "0.1.0" },
					],
					changesets: [{ id: "brave-lions-sing", releases: { "@scope/b": "minor" }, summary: "feat: bump b" }],
				});
				roots.push(root);
				const planner = yield* getPlanner(root);
				const result = yield* planner.apply(root, {
					snapshot: { tag: "next", useCalculatedVersion: true, prereleaseTemplate: "{tag}-{datetime}" },
				}) as Effect.Effect<Changesets.AppliedRelease>;

				const bRelease = result.releases.find((r) => r.name === "@scope/b");
				expect(bRelease).toBeDefined();
				expect(bRelease?.newVersion).toMatch(/^0\.2\.0-next-\d{14}$/);
				expect(bRelease?.type).toBe("minor");

				const bPkg = JSON.parse(readFileSync(join(root, "packages/b/package.json"), "utf-8")) as { version: string };
				expect(bPkg.version).toBe(bRelease?.newVersion);

				const aPkg = JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf-8")) as {
					dependencies: Record<string, string>;
				};
				expect(aPkg.dependencies["@scope/b"]).toBe(bRelease?.newVersion);

				expect(existsSync(join(root, "packages/b/CHANGELOG.md"))).toBe(true);
				expect(existsSync(join(root, ".changeset", "brave-lions-sing.md"))).toBe(false);
			}),
	);

	it.effect("useCalculatedVersion:false produces a 0.0.0 base version", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "quiet-frogs-hop", releases: { "@scope/a": "minor" }, summary: "feat: bump a" }],
			});
			roots.push(root);
			const planner = yield* getPlanner(root);
			const result = yield* planner.apply(root, {
				snapshot: { tag: "next", useCalculatedVersion: false, prereleaseTemplate: "{tag}-{datetime}" },
			}) as Effect.Effect<Changesets.AppliedRelease>;

			const release = result.releases.find((r) => r.name === "@scope/a");
			expect(release?.newVersion).toMatch(/^0\.0\.0-next-\d{14}$/);
		}),
	);

	it.effect("treats an empty tag like the bare --snapshot flag, still exact-pinning dependents", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [
					{
						dir: "packages/a",
						name: "@scope/a",
						version: "1.0.0",
						extra: { dependencies: { "@scope/b": "^0.1.0" } },
					},
					{ dir: "packages/b", name: "@scope/b", version: "0.1.0" },
				],
				changesets: [{ id: "empty-tags-pin", releases: { "@scope/b": "minor" }, summary: "feat: bump b" }],
			});
			roots.push(root);
			const planner = yield* getPlanner(root);
			const result = yield* planner.apply(root, {
				snapshot: { tag: "", useCalculatedVersion: true },
			}) as Effect.Effect<Changesets.AppliedRelease>;

			const bRelease = result.releases.find((r) => r.name === "@scope/b");
			expect(bRelease?.newVersion).toMatch(/^0\.2\.0-\d{14}$/);
			const aPkg = JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf-8")) as {
				dependencies: Record<string, string>;
			};
			expect(aPkg.dependencies["@scope/b"]).toBe(bRelease?.newVersion);
		}),
	);

	it.effect("reads changesets from the workspace root when called with a package subdirectory", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "deep-roots-grow", releases: { "@scope/a": "minor" }, summary: "feat: bump a" }],
			});
			roots.push(root);
			const subdir = join(root, "packages/a");
			const planner = yield* getPlanner(root);
			const result = yield* planner.apply(subdir, {
				snapshot: { tag: "next", useCalculatedVersion: true, prereleaseTemplate: "{tag}-{datetime}" },
			}) as Effect.Effect<Changesets.AppliedRelease>;

			const release = result.releases.find((r) => r.name === "@scope/a");
			expect(release?.newVersion).toMatch(/^1\.1\.0-next-\d{14}$/);
			expect(existsSync(join(root, ".changeset", "deep-roots-grow.md"))).toBe(false);
		}),
	);

	it.effect("fails typed in pre mode and leaves the tree untouched", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "sunny-crabs-wave", releases: { "@scope/a": "minor" }, summary: "feat: bump a" }],
			});
			roots.push(root);
			mkdirSync(join(root, ".changeset"), { recursive: true });
			writeFileSync(
				join(root, ".changeset", "pre.json"),
				JSON.stringify({ mode: "pre", tag: "next", initialVersions: { "@scope/a": "1.0.0" }, changesets: [] }, null, 2),
			);
			const planner = yield* getPlanner(root);
			const exit = yield* Effect.exit(planner.apply(root, { snapshot: { tag: "next" } }));

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.hasDies(exit.cause)).toBe(false);
				expect(Cause.pretty(exit.cause)).toContain("Snapshot release is not allowed in pre mode");
			}

			// tree untouched
			expect(JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf-8")).version).toBe("1.0.0");
			expect(existsSync(join(root, ".changeset", "sunny-crabs-wave.md"))).toBe(true);
		}),
	);

	describe("{commit}/{commit-short} template", () => {
		it.effect("fails typed when the template needs {commit} but no commit value is supplied", () =>
			Effect.gen(function* () {
				const root = makeReleaseFixture({
					packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
					changesets: [{ id: "eager-wolves-run", releases: { "@scope/a": "minor" }, summary: "feat: bump a" }],
				});
				roots.push(root);
				const planner = yield* getPlanner(root);
				const exit = yield* Effect.exit(
					planner.apply(root, { snapshot: { tag: "next", prereleaseTemplate: "{tag}-{commit}" } }),
				);
				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					expect(Cause.hasDies(exit.cause)).toBe(false);
					expect(Cause.pretty(exit.cause)).toContain("{commit}");
				}
			}),
		);

		it.effect("includes the supplied commit value in the version when the template uses {commit}", () =>
			Effect.gen(function* () {
				const root = makeReleaseFixture({
					packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
					changesets: [{ id: "eager-wolves-fly", releases: { "@scope/a": "minor" }, summary: "feat: bump a" }],
				});
				roots.push(root);
				const planner = yield* getPlanner(root);
				const result = yield* planner.apply(root, {
					snapshot: { tag: "next", commit: "abcdef1234567", prereleaseTemplate: "{tag}-{commit}" },
				}) as Effect.Effect<Changesets.AppliedRelease>;
				const release = result.releases.find((r) => r.name === "@scope/a");
				expect(release?.newVersion).toContain("abcdef1234567");
			}),
		);
	});
});

describe("ReleasePlanner.preview (snapshot)", () => {
	it.effect("returns the snapshot newVersion in changelogEntry and leaves the real tree untouched", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brisk-goats-run", releases: { "@scope/a": "minor" }, summary: "feat: preview snapshot" }],
			});
			roots.push(root);
			symlinkSync(repoNodeModules, join(root, "node_modules"), "dir");
			const planner = yield* getPlanner(root);
			const preview = yield* planner.preview(root, {
				snapshot: { tag: "next", useCalculatedVersion: true, prereleaseTemplate: "{tag}-{datetime}" },
			}) as Effect.Effect<Changesets.ChangesetPreview>;

			const release = preview.releases.find((r) => r.name === "@scope/a");
			expect(release).toBeDefined();
			expect(release?.newVersion).toMatch(/^1\.1\.0-next-\d{14}$/);
			expect(release?.changelogEntry).toContain(release?.newVersion ?? "");

			// real tree untouched
			expect(JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf-8")).version).toBe("1.0.0");
			expect(existsSync(join(root, "packages/a/CHANGELOG.md"))).toBe(false);
			expect(existsSync(join(root, ".changeset", "brisk-goats-run.md"))).toBe(true);
		}),
	);
});

describe("regression: no snapshot option", () => {
	it.effect("apply without snapshot still produces a plain calculated version", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "plain-otters-swim", releases: { "@scope/a": "minor" }, summary: "feat: plain bump" }],
			});
			roots.push(root);
			const planner = yield* getPlanner(root);
			const result = yield* planner.apply(root) as Effect.Effect<Changesets.AppliedRelease>;
			expect(result.releases.find((r) => r.name === "@scope/a")?.newVersion).toBe("1.1.0");
		}),
	);

	it.effect("preview without snapshot still produces a plain calculated version", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "plain-otters-fly", releases: { "@scope/a": "minor" }, summary: "feat: plain preview" }],
			});
			roots.push(root);
			symlinkSync(repoNodeModules, join(root, "node_modules"), "dir");
			const planner = yield* getPlanner(root);
			const preview = yield* planner.preview(root) as Effect.Effect<Changesets.ChangesetPreview>;
			expect(preview.releases.find((r) => r.name === "@scope/a")?.newVersion).toBe("1.1.0");
		}),
	);
});
