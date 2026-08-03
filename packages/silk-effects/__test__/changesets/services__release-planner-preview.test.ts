import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import { Changesets } from "../../src/index.js";
import { makeReleaseFixture, readFixtureChangelog } from "./support/release-fixture.js";

// Derive the monorepo node_modules from this test file's location:
// __test__/changesets/ -> __test__/ -> silk-effects/ -> packages/ -> systems/
const repoNodeModules = join(fileURLToPath(import.meta.url), "..", "..", "..", "..", "..", "node_modules");

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function getPlanner() {
	const InspectorStub = Changesets.makeConfigInspectorTest({
		configPath: "/x/.changeset/config.json",
		projectDir: "/x",
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

describe("ReleasePlanner.preview", () => {
	it.effect("returns an empty preview when there are no changesets", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [],
			});
			roots.push(root);
			const planner = yield* getPlanner();
			const preview = yield* planner.preview(root) as Effect.Effect<Changesets.ChangesetPreview>;
			expect(preview.releases).toEqual([]);
			expect(preview.changesets).toEqual([]);
		}),
	);

	it.effect("includes a Maintenance note in the changelogEntry of a fixed-group release with no changesets", () =>
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
			// symlink the monorepo node_modules so @changesets/cli/changelog resolves from this fixture root
			symlinkSync(repoNodeModules, join(root, "node_modules"), "dir");
			const planner = yield* getPlanner();
			const preview = yield* planner.preview(root) as Effect.Effect<Changesets.ChangesetPreview>;
			const fixed1 = preview.releases.find((r) => r.name === "@scope/fixed-1");
			expect(fixed1).toBeDefined();
			expect(fixed1?.changelogEntry).toContain("### Maintenance");
			expect(fixed1?.changelogEntry).toContain("`@scope/fixed-2@2.3.1`");
			expect(fixed1?.changelogEntry).toContain("(fixed version group)");
			const fixed2 = preview.releases.find((r) => r.name === "@scope/fixed-2");
			expect(fixed2).toBeDefined();
			expect(fixed2?.changelogEntry).not.toContain("### Maintenance");
		}),
	);

	it.effect("does not mutate the repo and matches a real apply (differential)", () =>
		Effect.gen(function* () {
			const spec = {
				packages: [
					{ dir: "packages/a", name: "@scope/a", version: "1.0.0", extra: { dependencies: { "@scope/b": "1.0.0" } } },
					{ dir: "packages/b", name: "@scope/b", version: "1.0.0" },
				],
				changesets: [
					{ id: "brave-pandas-learn", releases: { "@scope/a": "minor" as const }, summary: "feat: a thing" },
					{ id: "lazy-tigers-jump", releases: { "@scope/b": "patch" as const }, summary: "fix: b thing" },
				],
			};
			const root = makeReleaseFixture(spec);
			roots.push(root);
			// symlink the monorepo node_modules so @changesets/cli/changelog resolves from this fixture root
			symlinkSync(repoNodeModules, join(root, "node_modules"), "dir");

			// snapshot the changeset dir + manifests before preview
			const before = {
				cs: readFileSync(join(root, ".changeset", "brave-pandas-learn.md"), "utf-8"),
				a: readFileSync(join(root, "packages/a/package.json"), "utf-8"),
			};

			const planner = yield* getPlanner();
			const preview = yield* planner.preview(root) as Effect.Effect<Changesets.ChangesetPreview>;

			// non-destructive: changeset + manifest untouched
			expect(readFileSync(join(root, ".changeset", "brave-pandas-learn.md"), "utf-8")).toBe(before.cs);
			expect(readFileSync(join(root, "packages/a/package.json"), "utf-8")).toBe(before.a);

			// ground truth: clone the fixture, run the REAL changeset version + transform there
			const real = mkdtempSync(join(tmpdir(), "silk-relfix-real-"));
			roots.push(real);
			cpSync(root, real, { recursive: true, force: true }); // identical starting state
			execFileSync("pnpm", ["exec", "changeset", "version"], {
				cwd: real,
				stdio: "pipe",
				timeout: 120_000,
				killSignal: "SIGKILL",
			});
			for (const rel of ["packages/a", "packages/b"]) {
				const cl = join(real, rel, "CHANGELOG.md");
				Changesets.ChangelogTransformer.transformFile(cl);
			}

			for (const r of preview.releases) {
				const relDir = r.name === "@scope/a" ? "packages/a" : "packages/b";
				const realChangelog = readFixtureChangelog(real, relDir) ?? "";
				expect(realChangelog).toContain(`## ${r.newVersion}`);
				// the previewed block is the new top block of the real changelog
				expect(r.changelogEntry.length).toBeGreaterThan(r.changelogEntry.split("\n")[0].length);
				expect(realChangelog).toContain(r.changelogEntry.split("\n").slice(1).join("\n").trim().split("\n")[0]);
				expect(r.changelogEntry).toContain(`## ${r.newVersion}`);
			}
			expect(preview.releases.map((r) => r.name).sort()).toEqual(["@scope/a", "@scope/b"]);
		}),
	);
});

describe("ReleasePlanner.preview changelogModules", () => {
	it.effect("renders changelogEntry from a mapped module with no node_modules to resolve from", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "calm-owls-run", releases: { "@scope/a": "minor" }, summary: "feat: mapped changelog" }],
			});
			roots.push(root);
			// No node_modules symlink here, unlike the tests above: this fixture is the
			// zero-install case the release action's Phase 1 runs in, where the
			// configured id cannot be resolved by `import-meta-resolve` at all.
			const configPath = join(root, ".changeset/config.json");
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			config.changelog = ["@savvy-web/not-installed/changelog", { repo: "o/r" }];
			writeFileSync(configPath, JSON.stringify(config, null, 2));
			const modPath = join(root, "mapped-changelog.mjs");
			writeFileSync(
				modPath,
				"export default {\n" +
					// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional plain string containing literal backtick-quoted JS source, not a template literal.
					"  getReleaseLine: async (cs) => `- mapped: ${cs.summary}`,\n" +
					'  getDependencyReleaseLine: async () => "",\n' +
					"};\n",
			);

			const planner = yield* getPlanner();
			const preview = yield* planner.preview(root, {
				changelogModules: { "@savvy-web/not-installed/changelog": modPath },
			});

			const release = preview.releases.find((r) => r.name === "@scope/a");
			expect(release).toBeDefined();
			expect(release?.newVersion).toBe("1.1.0");
			expect(release?.changelogEntry).toContain("## 1.1.0");
			expect(release?.changelogEntry).toContain("mapped: feat: mapped changelog");
		}),
	);

	it.effect("fails with a typed preview error naming an unmapped id", () =>
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

			const planner = yield* getPlanner();
			const exit = yield* Effect.exit(
				planner.preview(root, { changelogModules: { "@savvy-web/changelog": "/tmp/nope.mjs" } }),
			);

			expect(Exit.isFailure(exit)).toBe(true);
			const message = Cause.pretty(Exit.isFailure(exit) ? exit.cause : Cause.empty);
			expect(message).toContain("preview");
			expect(message).toContain("@custom/generator");
			expect(message).toContain("@savvy-web/changelog");
		}),
	);

	it.effect("treats an id inherited from Object.prototype as unmapped", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "brave-pandas-learn", releases: { "@scope/a": "patch" }, summary: "fix: inherited id" }],
			});
			roots.push(root);
			const configPath = join(root, ".changeset/config.json");
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			// `changelogModules["toString"]` reads back Object.prototype.toString — a
			// function, not undefined — so a bare `=== undefined` check would accept it
			// and hand the engine a non-string specifier.
			config.changelog = ["toString", null];
			writeFileSync(configPath, JSON.stringify(config, null, 2));

			const planner = yield* getPlanner();
			const exit = yield* Effect.exit(
				planner.preview(root, { changelogModules: { "@savvy-web/changelog": "/tmp/nope.mjs" } }),
			);

			expect(Exit.isFailure(exit)).toBe(true);
			const message = Cause.pretty(Exit.isFailure(exit) ? exit.cause : Cause.empty);
			expect(message).toContain("is not in changelogModules");
			expect(message).toContain("toString");
		}),
	);

	it.effect("leaves today's behaviour untouched when the option is absent", () =>
		Effect.gen(function* () {
			const root = makeReleaseFixture({
				packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
				changesets: [{ id: "lazy-tigers-jump", releases: { "@scope/a": "patch" }, summary: "fix: default path" }],
			});
			roots.push(root);
			symlinkSync(repoNodeModules, join(root, "node_modules"), "dir");

			const planner = yield* getPlanner();
			const preview = yield* planner.preview(root);

			const release = preview.releases.find((r) => r.name === "@scope/a");
			expect(release?.newVersion).toBe("1.0.1");
			expect(release?.changelogEntry).toContain("fix: default path");
		}),
	);
});
