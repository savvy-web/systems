/**
 * Coverage tests for the Changesets namespace barrel exports.
 *
 * These modules are re-export entry points that are never imported
 * by other tests (which import from individual modules directly).
 * Importing them here ensures their module-level code is executed.
 */

import { describe, expect, it } from "vitest";

describe("Changesets namespace (src/changesets/index.ts)", () => {
	it("exports class-based API", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.Categories).toBeDefined();
		expect(mod.ChangesetLinter).toBeDefined();
		expect(mod.ChangelogTransformer).toBeDefined();
		expect(mod.Changelog).toBeDefined();
	});

	it("exports Effect services", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.ChangelogService).toBeDefined();
		expect(mod.GitHubService).toBeDefined();
		expect(mod.MarkdownService).toBeDefined();
	});

	it("exports the DepsRegen surface (WorkspaceSnapshotReader/resolveDiffRows removed in #208)", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.DepsRegen).toBeDefined();
		expect(mod.DepsRegenBase).toBeDefined();
		expect(mod.DepsRegenLive).toBeDefined();
		expect(mod.DepsRegenDefault).toBeDefined();
		expect(mod.isPureDependencyChangeset).toBeDefined();
		expect(mod.gitMergeBase).toBeDefined();
		expect(mod.computeWorkspaceDependencyDiffs).toBeDefined();
		// Removed public API — must no longer be exported.
		expect("WorkspaceSnapshotReader" in mod).toBe(false);
		expect("WorkspaceSnapshotReaderLive" in mod).toBe(false);
		expect("resolveDiffRows" in mod).toBe(false);
		expect("snapshotFromWorktree" in mod).toBe(false);
	});

	it("exports layers", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.GitHubLive).toBeDefined();
		expect(mod.MarkdownLive).toBeDefined();
	});

	it("exports tagged errors", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.ChangesetIOError).toBeDefined();
		expect(mod.ChangesetValidationError).toBeDefined();
		expect(mod.ConfigurationError).toBeDefined();
		expect(mod.GitHubApiError).toBeDefined();
		expect(mod.MarkdownParseError).toBeDefined();
	});

	it("exports schemas", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.ChangesetOptionsSchema).toBeDefined();
		expect(mod.RepoSchema).toBeDefined();
		expect(mod.SectionCategorySchema).toBeDefined();
		expect(mod.ChangesetSchema).toBeDefined();
		expect(mod.CommitHashSchema).toBeDefined();
		expect(mod.GitHubInfoSchema).toBeDefined();
		expect(mod.NonEmptyString).toBeDefined();
		expect(mod.PositiveInteger).toBeDefined();
	});

	it("exports dependency table utilities", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.DependencyTable).toBeDefined();
		expect(mod.DependencyTableRowSchema).toBeDefined();
		expect(mod.DependencyTableTypeSchema).toBeDefined();
		expect(mod.DependencyActionSchema).toBeDefined();
		expect(mod.DependencyTableSchema).toBeDefined();
		expect(mod.VersionOrEmptySchema).toBeDefined();
	});

	it("exports changelog formatter entry point", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.changelogFunctions).toBeDefined();
		expect(typeof mod.changelogFunctions.getReleaseLine).toBe("function");
		expect(typeof mod.changelogFunctions.getDependencyReleaseLine).toBe("function");
	});

	it("exports markdownlint rules array", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(Array.isArray(mod.SilkChangesetsRules)).toBe(true);
		expect(mod.SilkChangesetsRules).toHaveLength(5);
	});

	it("exports Markdownlint-prefixed rule aliases", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.MarkdownlintContentStructureRule).toBeDefined();
		expect(mod.MarkdownlintDependencyTableFormatRule).toBeDefined();
		expect(mod.MarkdownlintHeadingHierarchyRule).toBeDefined();
		expect(mod.MarkdownlintRequiredSectionsRule).toBeDefined();
		expect(mod.MarkdownlintUncategorizedContentRule).toBeDefined();
	});
});

describe("remark exports via Changesets namespace", () => {
	it("exports lint rules", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.HeadingHierarchyRule).toBeDefined();
		expect(mod.RequiredSectionsRule).toBeDefined();
		expect(mod.ContentStructureRule).toBeDefined();
		expect(mod.UncategorizedContentRule).toBeDefined();
		expect(mod.DependencyTableFormatRule).toBeDefined();
	});

	it("exports transform plugins", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.AggregateDependencyTablesPlugin).toBeDefined();
		expect(mod.MergeSectionsPlugin).toBeDefined();
		expect(mod.ReorderSectionsPlugin).toBeDefined();
		expect(mod.DeduplicateItemsPlugin).toBeDefined();
		expect(mod.ContributorFootnotesPlugin).toBeDefined();
		expect(mod.IssueLinkRefsPlugin).toBeDefined();
		expect(mod.NormalizeFormatPlugin).toBeDefined();
	});

	it("exports presets", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.SilkChangesetPreset).toHaveLength(5);
		expect(mod.SilkChangesetTransformPreset).toHaveLength(7);
	});

	it("exports the maintenance-note API", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.MaintenanceNotePlugin).toBeDefined();
		expect(mod.deriveMaintenanceReason).toBeDefined();
		expect(mod.MaintenanceReasonSchema).toBeDefined();
		expect(mod.MaintenanceTriggerSchema).toBeDefined();
	});
});
