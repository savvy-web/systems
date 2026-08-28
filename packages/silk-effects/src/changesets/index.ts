/**
 * Changesets namespace — changeset business logic extracted from \@savvy-web/changesets.
 *
 * @remarks
 * This barrel re-exports the complete changeset public surface (minus CLI/bin) from
 * the silk-effects package. Downstream consumers import via the Changesets namespace:
 *
 * ```typescript
 * import { Changesets } from "@savvy-web/silk-effects";
 * const { Categories, ChangelogTransformer, ChangesetLinter } = Changesets;
 * ```
 *
 */

// =============================================================================
// STEP 1 — SERVICE RECONCILIATION DECISIONS
// =============================================================================
//
// Services found under ../changesets/package/src/services/ in the source repo:
//
//   silk-publishability.ts — SKIPPED
//     silk-effects already exports SilkPublishability + SilkPublishability.layer
//     (src/services/SilkPublishability.ts). The changesets copy is the documented
//     "temporary home" (its own file says "The eventual home is @savvy-web/silk-effects").
//     The implementation in silk-effects is richer (supports `protocol`, `provenance`
//     in RawTargetSpec). Not copied; config-inspector.ts rewired to use
//     ../../services/ChangesetConfigReader.js for its ChangesetConfigReader dep.
//
//   changelog.ts — COPIED
//     Changeset-specific service tag (ChangelogService) for changelog formatting.
//     No equivalent in silk-effects. Found at ./services/changelog.ts.
//
//   github.ts — COPIED
//     GitHubService + GitHubService.layer + makeGitHubTest for commit metadata resolution.
//     No equivalent in silk-effects. Found at ./services/github.ts.
//
//   markdown.ts — COPIED
//     No equivalent in silk-effects. Found at ./services/markdown.ts.
//
//   branch-analyzer.ts — COPIED
//     BranchAnalyzer + BranchAnalyzer.layer for git diff + file classification.
//     No equivalent in silk-effects. Found at ./services/branch-analyzer.ts.
//
//   config-inspector.ts — COPIED (import of @savvy-web/silk-effects rewired to
//     ../../services/ChangesetConfigReader.js). No equivalent in silk-effects.
//     Found at ./services/config-inspector.ts.
//
//   workspace-snapshot.ts — REMOVED (#208)
//     The former WorkspaceSnapshotReader (git-ref side) and utils/worktree-snapshot.ts
//     (working-tree side) were replaced by @effected/workspaces' WorkspaceSnapshots
//     service, which snapshots both sides with per-ref catalog/workspace resolution.
//     Only gitMergeBase survives, relocated to ./utils/git.ts.
//
// =============================================================================

// === Class-Based API (for higher-level consumers) ===

export { Categories } from "./api/categories.js";
export { Changelog } from "./api/changelog.js";
export { DependencyTable } from "./api/dependency-table.js";
export type { LintMessage } from "./api/linter.js";
export { ChangesetLinter } from "./api/linter.js";
export type { TransformOptions } from "./api/transformer.js";
export { ChangelogTransformer } from "./api/transformer.js";

// === Changelog formatter entry point (Changesets API integration) ===
// This object implements ChangelogFunctions from @changesets/types — it is the
// value that belongs in .changeset/config.json under "changelog": ["...", opts].
export { default as changelogFunctions } from "./changelog/index.js";
// The stock changesets renderer (@changesets/changelog-git), re-exported so
// consumers need not depend on it directly. Exact upstream parity.
export { vanillaChangelogFunctions } from "./changelog/vanilla.js";

// === Effect Services ===

export type { BranchAnalysis, BranchAnalyzerShape, BranchFileEntry, FileStatus } from "./services/branch-analyzer.js";
export {
	BranchAnalysisSchema,
	BranchAnalyzer,
	BranchFileEntrySchema,
	FileStatusSchema,
	makeBranchAnalyzerTest,
} from "./services/branch-analyzer.js";
export type { ChangelogServiceShape } from "./services/changelog.js";
export { ChangelogService } from "./services/changelog.js";
export type {
	Classification,
	ClassificationReason,
	ConfigInspectorShape,
	InspectedConfig,
	ResolvedPackageScope,
	ResolvedVersionFile,
} from "./services/config-inspector.js";
export {
	ClassificationReasonSchema,
	ClassificationSchema,
	ConfigInspector,
	InspectedConfigSchema,
	ResolvedPackageScopeSchema,
	ResolvedVersionFileSchema,
	makeConfigInspectorTest,
} from "./services/config-inspector.js";
export type {
	CoexistingChangeset,
	DepsRegenOptions,
	DepsRegenPlanError,
	DepsRegenShape,
	RegenPlan,
	RegenResult,
} from "./services/deps-regen.js";
export {
	DepsRegen,
	DepsRegenDefault,
	isPureDependencyChangeset,
	makeDepsRegenDefault,
	parseChangesetPackages,
} from "./services/deps-regen.js";
export type { GitHubServiceShape } from "./services/github.js";
export { GitHubService } from "./services/github.js";
export type { MaintenanceReason, MaintenanceTrigger } from "./services/maintenance-reason.js";
export {
	MaintenanceReasonSchema,
	MaintenanceTriggerSchema,
	deriveMaintenanceReason,
} from "./services/maintenance-reason.js";
export type { ReleasePlannerShape } from "./services/release-planner.js";
export { ReleasePlanner, makeReleasePlannerTest } from "./services/release-planner.js";
// === Effect Layers ===

export { makeGitHubTest } from "./services/github.js";

// === Tagged Errors ===

export {
	ChangesetIOError,
	ChangesetValidationError,
	ConfigurationError,
	GitError,
	GitHubApiError,
	MarkdownParseError,
	ReleasePlanError,
	VersionFileError,
} from "./errors.js";

// === Schemas ===

export { SectionCategorySchema } from "./categories/types.js";
export type { Changeset, DependencyType, DependencyUpdate } from "./schemas/changeset.js";
export {
	ChangesetSchema,
	ChangesetSummarySchema,
	DependencyTypeSchema,
	DependencyUpdateSchema,
} from "./schemas/changeset.js";
export type { DependencyAction, DependencyTableRow, DependencyTableType } from "./schemas/dependency-table.js";
export {
	DependencyActionSchema,
	DependencyTableRowSchema,
	DependencyTableSchema,
	DependencyTableTypeSchema,
	VERSION_RE,
	VersionOrEmptySchema,
} from "./schemas/dependency-table.js";
export { CoexistingChangesetSchema, RegenPlanSchema, RegenResultSchema } from "./schemas/deps-regen.js";
export type { VersionType } from "./schemas/git.js";
export { CommitHashSchema, VersionTypeSchema } from "./schemas/git.js";
export type { GitHubInfo } from "./schemas/github.js";
export {
	GitHubInfoSchema,
	IssueNumberSchema,
	UrlOrMarkdownLinkSchema,
	UsernameSchema,
} from "./schemas/github.js";
export type { ChangesetOptions } from "./schemas/options.js";
export { ChangesetOptionsSchema, RepoSchema } from "./schemas/options.js";
export type { PackageScope } from "./schemas/package-scope.js";
export { GlobSchema, PackageScopeSchema, PackagesRecordSchema } from "./schemas/package-scope.js";
export { NonEmptyString, PositiveInteger } from "./schemas/primitives.js";
export type {
	AppliedRelease,
	BumpType,
	ChangesetPreview,
	PendingChangeset,
	PreviewRelease,
} from "./schemas/release-plan.js";
export {
	AppliedReleaseEntrySchema,
	AppliedReleaseSchema,
	BumpTypeSchema,
	ChangesetPreviewSchema,
	PendingChangesetSchema,
	PreviewReleaseSchema,
	VersionFileUpdateRecordSchema,
} from "./schemas/release-plan.js";
export type { LegacyVersionFileConfig, VersionFileConfig } from "./schemas/version-files.js";
export {
	JsonPathSchema,
	LegacyVersionFileConfigSchema,
	LegacyVersionFilesSchema,
	VersionFileConfigSchema,
	VersionFilesSchema,
} from "./schemas/version-files.js";

// === CLI Utilities ===
// Exported for use by @savvy-web/cli command implementations.

export type { WorkspaceDependencyDiff } from "./utils/dep-diff.js";
export { computeWorkspaceDependencyDiffs } from "./utils/dep-diff.js";
export { serializeDependencyTableToMarkdown } from "./utils/dependency-table.js";
export { gitMergeBase } from "./utils/git.js";
export { listPublishablePackageNames } from "./utils/publishability.js";
export type { VersionFileUpdate, WorkspaceVersion } from "./utils/version-files.js";
export { VersionFiles } from "./utils/version-files.js";

// === Types ===

export type { SectionCategory } from "./categories/types.js";
export type { GitHubCommitInfo } from "./vendor/github-info.js";

// === Markdownlint rules ===
// These are the markdownlint (micromark token API) implementations.
// Alias exports use "Markdownlint" prefix to avoid collision with remark rules.

// The default export is the rules array for markdownlint-cli2 `customRules` config.
export {
	ContentStructureRule as MarkdownlintContentStructureRule,
	DependencyTableFormatRule as MarkdownlintDependencyTableFormatRule,
	HeadingHierarchyRule as MarkdownlintHeadingHierarchyRule,
	RequiredSectionsRule as MarkdownlintRequiredSectionsRule,
	UncategorizedContentRule as MarkdownlintUncategorizedContentRule,
	default as SilkChangesetsRules,
} from "./markdownlint/index.js";

// === Remark Transform Plugins ===

export { AggregateDependencyTablesPlugin } from "./remark/plugins/aggregate-dependency-tables.js";
export { ContributorFootnotesPlugin } from "./remark/plugins/contributor-footnotes.js";
export { DeduplicateItemsPlugin } from "./remark/plugins/deduplicate-items.js";
export { IssueLinkRefsPlugin } from "./remark/plugins/issue-link-refs.js";
export type { MaintenanceNoteOptions } from "./remark/plugins/maintenance-note.js";
export { MaintenanceNotePlugin } from "./remark/plugins/maintenance-note.js";
export { MergeSectionsPlugin } from "./remark/plugins/merge-sections.js";
export { NormalizeFormatPlugin } from "./remark/plugins/normalize-format.js";
export { ReorderSectionsPlugin } from "./remark/plugins/reorder-sections.js";

// === Remark Presets ===

export { SilkChangesetPreset, SilkChangesetTransformPreset } from "./remark/presets.js";

// === Remark Lint Rules ===
// These are the unified/remark-lint implementations.

export { ContentStructureRule } from "./remark/rules/content-structure.js";
export { DependencyTableFormatRule } from "./remark/rules/dependency-table-format.js";
export { HeadingHierarchyRule } from "./remark/rules/heading-hierarchy.js";
export { RequiredSectionsRule } from "./remark/rules/required-sections.js";
export { UncategorizedContentRule } from "./remark/rules/uncategorized-content.js";
