import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
	ChangesetPreviewAsMarkdown,
	ChangesetPreviewResult,
	changesetPreview,
} from "../../src/tools/changeset-preview.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_b: string) => Effect.succeed("/repo") }),
);

const fixed: Changesets.ChangesetPreview = {
	preMode: null,
	releases: [
		{
			name: "@scope/a",
			type: "minor",
			oldVersion: "1.0.0",
			newVersion: "1.1.0",
			changesetIds: ["brave-pandas-learn"],
			changelogEntry: "## 1.1.0\n\n### Features\n\n- a thing",
		},
	],
	changesets: [{ id: "brave-pandas-learn", summary: "feat: a thing", releases: [{ name: "@scope/a", type: "minor" }] }],
};

const ReleasePlannerTest = Changesets.makeReleasePlannerTest({ preview: fixed });

describe("changeset_preview tool", () => {
	it("produces a structured result via the handler", async () => {
		const data = await Effect.runPromise(
			changesetPreview({ cwd: "/repo" }, "/repo").pipe(
				Effect.provide(Layer.mergeAll(WorkspaceRootTest, ReleasePlannerTest)),
			),
		);
		expect(Schema.decodeUnknownSync(ChangesetPreviewResult)(data)).toEqual(data);
		expect(data.releases[0].newVersion).toBe("1.1.0");
	});

	it("renders markdown with a bump table and the changelog block", () => {
		const text = Schema.decodeUnknownSync(ChangesetPreviewAsMarkdown)({ ...fixed });
		expect(text).toContain("@scope/a");
		expect(text).toContain("1.0.0");
		expect(text).toContain("1.1.0");
		expect(text).toContain("### Features");
	});

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeUnknownSync(ChangesetPreviewAsMarkdown)("# nope")).toThrow();
	});
});
