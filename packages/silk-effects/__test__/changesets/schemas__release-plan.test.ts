import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { Changesets } from "../../src/index.js";

describe("release-plan schemas", () => {
	it("decodes a ChangesetPreview", () => {
		const value: Changesets.ChangesetPreview = {
			preMode: null,
			releases: [
				{
					name: "@scope/a",
					type: "minor",
					oldVersion: "1.0.0",
					newVersion: "1.1.0",
					changesetIds: ["brave-pandas-learn"],
					changelogEntry: "## 1.1.0\n\n### Features\n\n- thing",
				},
			],
			changesets: [
				{ id: "brave-pandas-learn", summary: "feat: thing", releases: [{ name: "@scope/a", type: "minor" }] },
			],
		};
		expect(Schema.decodeUnknownSync(Changesets.ChangesetPreviewSchema)(value)).toEqual(value);
	});

	it("decodes an AppliedRelease", () => {
		const value: Changesets.AppliedRelease = {
			dryRun: true,
			touchedFiles: [],
			releases: [{ name: "@scope/a", type: "patch", oldVersion: "1.0.0", newVersion: "1.0.1" }],
			versionFileUpdates: [{ filePath: "/x/plugin.json", version: "1.0.1" }],
		};
		expect(Schema.decodeUnknownSync(Changesets.AppliedReleaseSchema)(value)).toEqual(value);
	});

	it("constructs a ReleasePlanError with a message", () => {
		const err = new Changesets.ReleasePlanError({ phase: "preview", reason: "boom" });
		expect(err.message).toBe("Release plan error (preview): boom");
	});
});
