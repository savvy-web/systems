/**
 * `vanillaChangelogFunctions` — the stock changesets renderer (systems#413).
 * Parity with upstream matters: every output must equal
 * `@changesets/changelog-git`'s for the same input. Upstream is a
 * devDependency here only as the oracle.
 */

import upstream from "@changesets/changelog-git";
import { describe, expect, it } from "vitest";
import { vanillaChangelogFunctions } from "../../src/changesets/changelog/vanilla.js";
import { vanillaChangelogFunctions as fromBarrel } from "../../src/changesets/index.js";
import type { ModCompWithPackage, NewChangesetWithCommit } from "../../src/changesets/vendor/types.js";

const changeset = (summary: string, commit?: string): NewChangesetWithCommit => ({
	id: "vanilla",
	summary,
	releases: [{ name: "pkg", type: "patch" }],
	...(commit === undefined ? {} : { commit }),
});

const dependency = (name: string, newVersion: string | undefined): ModCompWithPackage =>
	(newVersion === undefined
		? {
				name,
				type: "none",
				oldVersion: undefined,
				newVersion: undefined,
				changesets: [],
				packageJson: { name, version: "1.0.0" },
				dir: `/packages/${name}`,
			}
		: {
				name,
				type: "patch",
				oldVersion: "1.0.0",
				newVersion,
				changesets: [],
				packageJson: { name, version: newVersion },
				dir: `/packages/${name}`,
			}) as ModCompWithPackage;

const summaries = [
	"Fix a thing",
	"",
	"Fix a thing   ",
	"First line\nSecond line",
	"First line\n\nThird line after a blank\n",
	"Trailing spaces   \n  indented continuation  \n\t tab",
	"- a bullet\n- another bullet",
	"Windows\r\nline endings\r\n",
];
const commits = [undefined, "abc1234567890def", "abc", ""];

describe("vanillaChangelogFunctions", () => {
	it("is exported from the Changesets namespace barrel", () => {
		expect(fromBarrel).toBe(vanillaChangelogFunctions);
	});

	describe("getReleaseLine matches @changesets/changelog-git", () => {
		for (const summary of summaries) {
			for (const commit of commits) {
				it(`summary ${JSON.stringify(summary)}, commit ${JSON.stringify(commit)}`, async () => {
					const input = changeset(summary, commit);
					const ours = await vanillaChangelogFunctions.getReleaseLine(input, "patch", null);
					const theirs = await upstream.getReleaseLine(input, "patch", null);
					expect(ours).toBe(theirs);
				});
			}
		}
	});

	describe("getDependencyReleaseLine matches @changesets/changelog-git", () => {
		const cases: ReadonlyArray<readonly [string, NewChangesetWithCommit[], ModCompWithPackage[]]> = [
			["no dependencies updated", [changeset("bump", "abc1234567")], []],
			["no changesets, one dependency", [], [dependency("some-dep", "1.0.1")]],
			["one changeset with a commit", [changeset("bump", "abc1234567")], [dependency("some-dep", "1.0.1")]],
			["one changeset without a commit", [changeset("bump")], [dependency("some-dep", "1.0.1")]],
			[
				"several changesets and dependencies",
				[changeset("a", "1111111aaaa"), changeset("b"), changeset("c", "2222222bbbb")],
				[dependency("dep-a", "2.0.0"), dependency("@scope/dep-b", "0.1.0-next.0")],
			],
			["a none dependency with no new version", [changeset("bump", "abc1234567")], [dependency("none-dep", undefined)]],
		];
		for (const [name, changesets, dependencies] of cases) {
			it(name, async () => {
				const ours = await vanillaChangelogFunctions.getDependencyReleaseLine(changesets, dependencies, null);
				const theirs = await upstream.getDependencyReleaseLine(changesets, dependencies, null);
				expect(ours).toBe(theirs);
			});
		}
	});

	it("returns synchronously, as upstream does", () => {
		const input = changeset("Fix a thing", "abc1234567");
		expect(typeof vanillaChangelogFunctions.getReleaseLine(input, "patch", null)).toBe("string");
		expect(typeof upstream.getReleaseLine(input, "patch", null)).toBe("string");
	});
});
