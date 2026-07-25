import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { getDependencyReleaseLine } from "../../src/changesets/changelog/getDependencyReleaseLine.js";
import type { ChangesetOptions } from "../../src/changesets/schemas/options.js";
import { makeGitHubTest } from "../../src/changesets/services/github.js";
import type { GitHubCommitInfo } from "../../src/changesets/vendor/github-info.js";
import type { ModCompWithPackage, NewChangesetWithCommit } from "../../src/changesets/vendor/types.js";

const OPTIONS: ChangesetOptions = { repo: "owner/repo" };

const MOCK_INFO_A: GitHubCommitInfo = {
	user: "alice",
	pull: 10,
	links: {
		commit: "[`abc1234`](https://github.com/owner/repo/commit/abc1234567890)",
		pull: "https://github.com/owner/repo/pull/10",
		user: "https://github.com/alice",
	},
};

const testLayer = makeGitHubTest(new Map([["abc1234567890", MOCK_INFO_A]]));

function makeDep(name: string, newVersion: string, deps?: Record<string, Record<string, string>>): ModCompWithPackage {
	return {
		name,
		type: "patch",
		oldVersion: "1.0.0",
		newVersion,
		changesets: [],
		packageJson: { name, version: newVersion, ...deps },
		dir: `/packages/${name}`,
	};
}

describe("getDependencyReleaseLine", () => {
	it.effect("returns empty string (no heading) when no dependencies were updated", () =>
		Effect.gen(function* () {
			const changesets: NewChangesetWithCommit[] = [
				{ id: "cs-1", summary: "bump", releases: [], commit: "abc1234567890" },
			];
			const result = yield* getDependencyReleaseLine(changesets, [], OPTIONS).pipe(Effect.provide(testLayer));
			expect(result).toBe("");
		}),
	);

	it.effect("prefixes the table with a ### Dependencies heading", () =>
		Effect.gen(function* () {
			const changesets: NewChangesetWithCommit[] = [{ id: "cs-1", summary: "bump", releases: [] }];
			const deps = [makeDep("@scope/dep", "1.1.0")];

			const result = yield* getDependencyReleaseLine(changesets, deps, OPTIONS).pipe(Effect.provide(testLayer));

			expect(result.startsWith("### Dependencies\n\n")).toBe(true);
			expect(result).toContain("| Dependency |");
		}),
	);

	it.effect("emits a markdown table with correct columns", () =>
		Effect.gen(function* () {
			const changesets: NewChangesetWithCommit[] = [{ id: "cs-1", summary: "bump", releases: [] }];
			const deps = [makeDep("typescript", "5.0.0", { devDependencies: { typescript: "^5.0.0" } })];

			const result = yield* getDependencyReleaseLine(changesets, deps, OPTIONS).pipe(Effect.provide(testLayer));

			// Column headers — remark-stringify pads columns for alignment
			expect(result).toMatch(/\| Dependency\s*\|/);
			expect(result).toMatch(/\| Type\s*\|/);
			expect(result).toMatch(/\| Action\s*\|/);
			expect(result).toMatch(/\| From\s*\|/);
			expect(result).toMatch(/\| To\s*\|/);
			expect(result).toContain("typescript");
			expect(result).toContain("devDependency");
			expect(result).toContain("updated");
		}),
	);

	it.effect("infers dependency type from packageJson fields", () =>
		Effect.gen(function* () {
			const changesets: NewChangesetWithCommit[] = [{ id: "cs-1", summary: "bump", releases: [] }];
			const deps = [
				makeDep("foo", "2.0.0", { dependencies: { foo: "^2.0.0" } }),
				makeDep("bar", "3.0.0", { peerDependencies: { bar: "^3.0.0" } }),
			];

			const result = yield* getDependencyReleaseLine(changesets, deps, OPTIONS).pipe(Effect.provide(testLayer));

			expect(result).toContain("dependency");
			expect(result).toContain("peerDependency");
		}),
	);

	it.effect("infers optionalDependency type", () =>
		Effect.gen(function* () {
			const changesets: NewChangesetWithCommit[] = [{ id: "cs-1", summary: "bump", releases: [] }];
			const deps = [makeDep("opt-pkg", "2.0.0", { optionalDependencies: { "opt-pkg": "^2.0.0" } })];

			const result = yield* getDependencyReleaseLine(changesets, deps, OPTIONS).pipe(Effect.provide(testLayer));

			expect(result).toContain("optionalDependency");
		}),
	);

	it.effect("falls back to dependency type when not found in any field", () =>
		Effect.gen(function* () {
			const changesets: NewChangesetWithCommit[] = [{ id: "cs-1", summary: "bump", releases: [] }];
			const deps = [makeDep("unknown-pkg", "2.0.0")];

			const result = yield* getDependencyReleaseLine(changesets, deps, OPTIONS).pipe(Effect.provide(testLayer));

			expect(result).toContain("dependency");
		}),
	);
});
