/**
 * `vanillaChangelogFunctions` — the stock changesets renderer, re-exported
 * (systems#413). Parity with upstream matters: the export must BE
 * `@changesets/changelog-git`'s default, not a reimplementation.
 */

import upstream from "@changesets/changelog-git";
import { describe, expect, it } from "vitest";
import { vanillaChangelogFunctions } from "../../src/changesets/changelog/vanilla.js";
import { vanillaChangelogFunctions as fromBarrel } from "../../src/changesets/index.js";

describe("vanillaChangelogFunctions", () => {
	it("is the identical @changesets/changelog-git default export", () => {
		expect(vanillaChangelogFunctions).toBe(upstream);
	});

	it("is exported from the Changesets namespace barrel", () => {
		expect(fromBarrel).toBe(vanillaChangelogFunctions);
	});

	it("getReleaseLine is callable and renders the summary", async () => {
		const line = await vanillaChangelogFunctions.getReleaseLine(
			{
				id: "vanilla-1",
				summary: "Fix a thing",
				releases: [{ name: "pkg", type: "patch" }],
			},
			"patch",
			null,
		);
		expect(typeof line).toBe("string");
		expect(line).toContain("Fix a thing");
	});

	it("getDependencyReleaseLine is callable and names the bumped dependency", async () => {
		const line = await vanillaChangelogFunctions.getDependencyReleaseLine(
			[
				{
					id: "vanilla-2",
					summary: "bump",
					releases: [],
					commit: "abc1234",
				},
			],
			[
				{
					name: "some-dep",
					type: "patch",
					oldVersion: "1.0.0",
					newVersion: "1.0.1",
					changesets: [],
					packageJson: { name: "some-dep", version: "1.0.1" },
					dir: "/packages/some-dep",
				},
			],
			null,
		);
		expect(typeof line).toBe("string");
		expect(line).toContain("some-dep@1.0.1");
	});
});
