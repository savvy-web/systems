import { describe, expect, it } from "@effect/vitest";
import { CatalogSet, PackageStateSnapshot, WorkspaceStateSnapshot } from "@effected/workspaces";
import { Schema } from "effect";
import type {
	CoexistingChangeset,
	RegenDiffRow,
	RegenPlan,
	RegenResult,
} from "../../src/changesets/schemas/deps-regen.js";
import {
	CoexistingChangesetSchema,
	RegenDiffRowSchema,
	RegenPlanSchema,
	RegenResultSchema,
} from "../../src/changesets/schemas/deps-regen.js";
import { computeWorkspaceDependencyDiffs } from "../../src/changesets/utils/dep-diff.js";

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

	it("decodes a RegenDiffRow with unresolved raw specifier cells", () => {
		const value: RegenDiffRow = {
			dependency: "typescript",
			type: "dependency",
			action: "updated",
			from: "^1.2",
			to: "*",
		};
		expect(Schema.decodeUnknownSync(RegenDiffRowSchema)(value)).toEqual(value);
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

	it("still validates dependency action/type in plan rows", () => {
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

	it("decodes a RegenPlan built from real computeWorkspaceDependencyDiffs output", () => {
		const makeSnapshot = (spec: string) =>
			new WorkspaceStateSnapshot({
				packages: [
					new PackageStateSnapshot({
						name: "@scope/foo",
						version: "1.0.0",
						relativePath: "packages/foo",
						dependencies: { typescript: spec },
					}),
				],
				catalogs: CatalogSet.empty(),
			});
		const [diff] = computeWorkspaceDependencyDiffs(makeSnapshot("^1.2"), makeSnapshot("*"));
		expect(diff).toBeDefined();
		if (!diff) {
			throw new Error("expected at least one dependency diff row");
		}
		const plan: RegenPlan = {
			toDelete: [],
			toWrite: [
				{
					file: "/repo/.changeset/new-note.md",
					package: "@scope/foo",
					diff: {
						package: diff.package,
						relativePath: diff.relativePath,
						rows: diff.rows,
					},
				},
			],
			skippedMixed: [],
			coexisting: [],
		};
		expect(Schema.decodeUnknownSync(RegenPlanSchema)(plan)).toEqual(plan);
	});
});
