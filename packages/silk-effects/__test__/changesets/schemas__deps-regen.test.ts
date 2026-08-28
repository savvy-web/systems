import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import type { CoexistingChangeset, RegenPlan, RegenResult } from "../../src/changesets/schemas/deps-regen.js";
import {
	CoexistingChangesetSchema,
	RegenPlanSchema,
	RegenResultSchema,
} from "../../src/changesets/schemas/deps-regen.js";

describe("deps-regen schemas", () => {
	it("decodes a CoexistingChangeset", () => {
		const value: CoexistingChangeset = {
			file: "/repo/.changeset/quiet-owls-rest.md",
			packages: ["@scope/foo"],
		};
		expect(Schema.decodeUnknownSync(CoexistingChangesetSchema)(value)).toEqual(value);
	});

	it("decodes a RegenPlan", () => {
		const value: RegenPlan = {
			toDelete: [{ file: "/repo/.changeset/old-note.md", package: "@scope/foo" }],
			toWrite: [
				{
					file: "/repo/.changeset/new-note.md",
					package: "@scope/foo",
					diff: {
						package: "@scope/foo",
						relativePath: "packages/foo",
						rows: [
							{
								dependency: "effect",
								type: "dependency",
								action: "updated",
								from: "3.19.0",
								to: "4.0.0-beta.94",
							},
						],
					},
				},
			],
			skippedMixed: ["/repo/.changeset/mixed.md"],
			coexisting: [{ file: "/repo/.changeset/prose.md", packages: ["@scope/foo"] }],
		};
		expect(Schema.decodeUnknownSync(RegenPlanSchema)(value)).toEqual(value);
	});

	it("decodes a RegenResult", () => {
		const value: RegenResult = {
			deleted: ["/repo/.changeset/old-note.md"],
			written: ["/repo/.changeset/new-note.md"],
			skippedMixed: ["/repo/.changeset/mixed.md"],
			coexisting: [{ file: "/repo/.changeset/prose.md", packages: ["@scope/foo"] }],
		};
		expect(Schema.decodeUnknownSync(RegenResultSchema)(value)).toEqual(value);
	});

	it("reuses dependency-row validation for plan diffs", () => {
		const decode = Schema.decodeUnknownSync(RegenPlanSchema);
		expect(() =>
			decode({
				toDelete: [],
				toWrite: [
					{
						file: "/repo/.changeset/new-note.md",
						package: "@scope/foo",
						diff: {
							package: "@scope/foo",
							relativePath: "packages/foo",
							rows: [
								{
									dependency: "effect",
									type: "dependency",
									action: "changed",
									from: "3.19.0",
									to: "4.0.0-beta.94",
								},
							],
						},
					},
				],
				skippedMixed: [],
				coexisting: [],
			}),
		).toThrow();
	});
});
