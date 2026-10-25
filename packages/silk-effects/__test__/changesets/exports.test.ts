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
		expect((mod as Record<string, unknown>).SilkChangesetTransformPreset).toBeUndefined();
		expect(mod.Categories).toBeDefined();
		expect(mod.ChangesetLinter).toBeDefined();
		expect(mod.ChangelogTransformer).toBeDefined();
		expect(mod.Changelog).toBeDefined();
	});

	it("exports Effect services", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.ChangelogService).toBeDefined();
		expect(mod.GitHubService).toBeDefined();
	});

	it("exports the DepsRegen surface (WorkspaceSnapshotReader/resolveDiffRows removed in #208)", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.DepsRegen).toBeDefined();
		// DepsRegenBase removed in the v4 port (inline Context.Service + _base suppression).
		expect("DepsRegenBase" in mod).toBe(false);
		expect(mod.DepsRegen.layer).toBeDefined();
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
		expect(mod.GitHubService.layer).toBeDefined();
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
		expect(mod.CoexistingChangesetSchema).toBeDefined();
		expect(mod.RegenDiffRowSchema).toBeDefined();
		expect(mod.RegenPlanSchema).toBeDefined();
		expect(mod.RegenResultSchema).toBeDefined();
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

describe("maintenance exports via Changesets namespace", () => {
	it("exports the maintenance-reason API", async () => {
		const mod = await import("../../src/changesets/index.js");
		expect(mod.deriveMaintenanceReason).toBeDefined();
		expect(mod.MaintenanceReasonSchema).toBeDefined();
		expect(mod.MaintenanceTriggerSchema).toBeDefined();
	});
});
