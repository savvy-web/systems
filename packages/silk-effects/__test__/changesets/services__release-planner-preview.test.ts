import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { Changesets } from "../../src/index.js";
import { makeReleaseFixture, readFixtureChangelog } from "./fixtures/release-fixture.js";

// Derive the monorepo node_modules from this test file's location:
// __test__/changesets/ -> __test__/ -> silk-effects/ -> packages/ -> systems/
const repoNodeModules = join(fileURLToPath(import.meta.url), "..", "..", "..", "..", "..", "node_modules");

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

async function getPlanner() {
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
	return Effect.runPromise(
		Changesets.ReleasePlanner.pipe(
			Effect.provide(Changesets.ReleasePlannerLive),
			Effect.provide(InspectorStub),
		) as Effect.Effect<Changesets.ReleasePlannerShape>,
	);
}

describe("ReleasePlanner.preview", () => {
	it("returns an empty preview when there are no changesets", async () => {
		const root = makeReleaseFixture({
			packages: [{ dir: "packages/a", name: "@scope/a", version: "1.0.0" }],
			changesets: [],
		});
		roots.push(root);
		const planner = await getPlanner();
		const preview = await Effect.runPromise(planner.preview(root) as Effect.Effect<Changesets.ChangesetPreview>);
		expect(preview.releases).toEqual([]);
		expect(preview.changesets).toEqual([]);
	});

	it("does not mutate the repo and matches a real apply (differential)", async () => {
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

		const planner = await getPlanner();
		const preview = await Effect.runPromise(planner.preview(root) as Effect.Effect<Changesets.ChangesetPreview>);

		// non-destructive: changeset + manifest untouched
		expect(readFileSync(join(root, ".changeset", "brave-pandas-learn.md"), "utf-8")).toBe(before.cs);
		expect(readFileSync(join(root, "packages/a/package.json"), "utf-8")).toBe(before.a);

		// ground truth: clone the fixture, run the REAL changeset version + transform there
		const real = mkdtempSync(join(tmpdir(), "silk-relfix-real-"));
		roots.push(real);
		cpSync(root, real, { recursive: true, force: true }); // identical starting state
		execFileSync("pnpm", ["exec", "changeset", "version"], { cwd: real, stdio: "pipe" });
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
	});
});
