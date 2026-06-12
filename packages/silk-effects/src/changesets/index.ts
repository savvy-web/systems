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
 * @packageDocumentation
 */

// =============================================================================
// STEP 1 — SERVICE RECONCILIATION DECISIONS
// =============================================================================
//
// Services found under ../changesets/package/src/services/ in the source repo:
//
//   silk-publishability.ts — SKIPPED
//     silk-effects already exports SilkPublishability + SilkPublishabilityDetectorLive
//     (src/services/SilkPublishability.ts). The changesets copy is the documented
//     "temporary home" (its own file says "The eventual home is @savvy-web/silk-effects").
//     The implementation in silk-effects is richer (supports `protocol`, `provenance`
//     in RawTargetSpec). Not copied; config-inspector.ts rewired to use
//     ../../services/ChangesetConfigReader.js for its ChangesetConfigReader dep.
//
//   changelog.ts — COPIED
//     Changeset-specific service tag (ChangelogService) for changelog formatting.
//     No equivalent in silk-effects. Lives at ./services/changelog.ts.
//
//   github.ts — COPIED
//     GitHubService + GitHubLive + makeGitHubTest for commit metadata resolution.
//     No equivalent in silk-effects. Lives at ./services/github.ts.
//
//   markdown.ts — COPIED
//     MarkdownService + MarkdownLive for markdown AST parse/stringify.
//     No equivalent in silk-effects. Lives at ./services/markdown.ts.
//
//   branch-analyzer.ts — COPIED
//     BranchAnalyzer + BranchAnalyzerLive for git diff + file classification.
//     No equivalent in silk-effects. Lives at ./services/branch-analyzer.ts.
//
//   config-inspector.ts — COPIED (import of @savvy-web/silk-effects rewired to
//     ../../services/ChangesetConfigReader.js). No equivalent in silk-effects.
//     Lives at ./services/config-inspector.ts.
//
//   workspace-snapshot.ts — COPIED
//     WorkspaceSnapshotReader + WorkspaceSnapshotReaderLive for reading workspace
//     state at arbitrary git refs. No equivalent in silk-effects.
//     Lives at ./services/workspace-snapshot.ts.
//
// =============================================================================

// === Class-Based API (for higher-level consumers) ===

export { Categories } from "./api/categories.js";
export { Changelog } from "./api/changelog.js";
export { DependencyTable } from "./api/dependency-table.js";
export type { LintMessage } from "./api/linter.js";
export { ChangesetLinter } from "./api/linter.js";
export { ChangelogTransformer } from "./api/transformer.js";

// === Changelog formatter entry point (Changesets API integration) ===
// This object implements ChangelogFunctions from @changesets/types — it is the
// value that belongs in .changeset/config.json under "changelog": ["...", opts].
export { default as changelogFunctions } from "./changelog/index.js";

// === Effect Services ===

export type { BranchAnalysis, BranchAnalyzerShape, BranchFileEntry, FileStatus } from "./services/branch-analyzer.js";
export {
	BranchAnalysisSchema,
	BranchAnalyzer,
	BranchAnalyzerBase,
	BranchAnalyzerLive,
	BranchFileEntrySchema,
	FileStatusSchema,
	makeBranchAnalyzerTest,
} from "./services/branch-analyzer.js";
export type { ChangelogServiceShape } from "./services/changelog.js";
export { ChangelogService, ChangelogServiceBase } from "./services/changelog.js";
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
	ConfigInspectorBase,
	ConfigInspectorLive,
	InspectedConfigSchema,
	ResolvedPackageScopeSchema,
	ResolvedVersionFileSchema,
	makeConfigInspectorTest,
} from "./services/config-inspector.js";
export type { GitHubServiceShape } from "./services/github.js";
export { GitHubService, GitHubServiceBase } from "./services/github.js";
export type { MarkdownServiceShape } from "./services/markdown.js";
export { MarkdownService, MarkdownServiceBase } from "./services/markdown.js";
export type { WorkspaceSnapshot, WorkspaceSnapshotReaderShape } from "./services/workspace-snapshot.js";
export {
	WorkspaceSnapshotReader,
	WorkspaceSnapshotReaderBase,
	WorkspaceSnapshotReaderLive,
} from "./services/workspace-snapshot.js";

// === Effect Layers ===

export { GitHubLive, makeGitHubTest } from "./services/github.js";
export { MarkdownLive } from "./services/markdown.js";

// === Tagged Errors ===

export {
	ChangesetValidationError,
	ChangesetValidationErrorBase,
	ConfigurationError,
	ConfigurationErrorBase,
	GitError,
	GitErrorBase,
	GitHubApiError,
	GitHubApiErrorBase,
	MarkdownParseError,
	MarkdownParseErrorBase,
	VersionFileError,
	VersionFileErrorBase,
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
	VersionOrEmptySchema,
} from "./schemas/dependency-table.js";
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
export { listPublishablePackageNames } from "./utils/publishability.js";
export type { VersionFileUpdate, WorkspaceVersion } from "./utils/version-files.js";
export { VersionFiles } from "./utils/version-files.js";
export { gitMergeBase, snapshotFromWorktree } from "./utils/worktree-snapshot.js";

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
