---
id: packages/silk-effects/api/namespace/changesets
title: "Changesets — silk-effects namespace"
summary: "namespace Changesets from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# Changesets

## Members

### AggregateDependencyTablesPlugin

```ts
AggregateDependencyTablesPlugin: Plugin<[], Root>
```

### BranchAnalysis

```ts
interface BranchAnalysis
```

Structured result of analyzing the current branch against its base.

### BranchAnalyzer

```ts
class BranchAnalyzer extends BranchAnalyzerBase
```

Effect service tag for BranchAnalyzerShape.

### BranchAnalyzerLive

```ts
BranchAnalyzerLive: Layer.Layer<BranchAnalyzer, never, ConfigInspector>
```

Live layer for BranchAnalyzer. Requires ConfigInspector (which in turn requires `ChangesetConfigReader` and `WorkspaceDiscovery`).

### BranchAnalyzerShape

```ts
interface BranchAnalyzerShape
```

Effect service interface for branch analysis.

### BranchFileEntry

```ts
interface BranchFileEntry
```

One file entry in the branch analysis output.

### Categories

```ts
class Categories
```

Static class wrapper for section category operations. Provides methods for resolving conventional commit types to changelog section categories, validating section headings, and accessing the canonical set of 13 section categories used throughout the pipeline.

### Changelog

```ts
class Changelog
```

Static class wrapper for changelog formatting operations. Delegates to the [Changesets](silk://packages/silk-effects/api/namespace/changesets)-compatible `getReleaseLine` and `getDependencyReleaseLine` functions. Internally, these use the ChangelogService Effect service layer, which coordinates the GitHubService (for commit/PR metadata) and MarkdownService (for AST manipulation) to produce structured changelog entries.

### ChangelogService

```ts
class ChangelogService extends ChangelogServiceBase
```

Effect service tag for changelog formatting. Provides dependency-injected access to the two [Changesets](silk://packages/silk-effects/api/namespace/changesets) API formatter functions: `formatReleaseLine` and `formatDependencyReleaseLine`.

### ChangelogServiceShape

```ts
interface ChangelogServiceShape
```

Service interface for changelog formatting. Describes the two operations a `ChangelogService` implementation must provide: formatting individual release lines and formatting dependency update tables.

### ChangelogTransformer

```ts
class ChangelogTransformer
```

Static class for post-processing CHANGELOG.md files. Implements the third layer of the three-layer pipeline by running six remark transform plugins in a fixed order to clean up, normalize, and enhance changelog output produced by the formatter layer.

### Changeset

```ts
interface Changeset extends Schema.Schema.Type<typeof ChangesetSchema>
```

Inferred type for ChangesetSchema.

### ChangesetLinter

```ts
class ChangesetLinter
```

Static class for linting changeset markdown files. Runs the four remark-lint rules (heading-hierarchy, required-sections, content-structure, uncategorized-content) against changeset markdown and returns structured LintMessage diagnostics.

### ChangesetOptions

```ts
interface ChangesetOptions extends Schema.Schema.Type<typeof ChangesetOptionsSchema>
```

Inferred type for ChangesetOptionsSchema.

### ChangesetOptionsSchema

```ts
ChangesetOptionsSchema: Schema.filter<Schema.Struct<{
    repo: Schema.filter<typeof Schema.String>;
    commitLinks: Schema.optional<typeof Schema.Boolean>;
    prLinks: Schema.optional<typeof Schema.Boolean>;
    issueLinks: Schema.optional<typeof Schema.Boolean>;
    issuePrefixes: Schema.optional<Schema.Array$<typeof Schema.String>>;
    packages: Schema.optional<Schema.Record$<typeof Schema.String, Schema.Struct<{
        additionalScopes: Schema.optional<Schema.Array$<Schema.filter<Schema.filter<typeof Schema.String>>>>;
        versionFiles: Schema.optional<Schema.Array$<Schema.Struct<{
            glob: Schema.filter<typeof Schema.String>;
            paths: Schema.optional<Schema.Array$<Schema.filter<typeof Schema.String>>>;
        }>>>;
    }>>>;
    versionFiles: Schema.optional<Schema.Array$<Schema.Struct<{
        glob: Schema.filter<typeof Schema.String>;
        paths: Schema.optional<Schema.Array$<Schema.filter<typeof Schema.String>>>;
        package: Schema.optional<Schema.filter<typeof Schema.String>>;
    }>>>;
}>>
```

Schema for changeset configuration options.

### ChangesetSchema

```ts
ChangesetSchema: Schema.Struct<{
    summary: Schema.filter<Schema.filter<typeof Schema.String>>;
    id: typeof Schema.String;
    commit: Schema.optional<Schema.filter<typeof Schema.String>>;
}>
```

Schema for a changeset object.

### ChangesetSummarySchema

```ts
ChangesetSummarySchema: Schema.filter<Schema.filter<typeof Schema.String>>
```

Schema for a changeset summary (1--1000 characters).

### ChangesetValidationError

```ts
class ChangesetValidationError extends ChangesetValidationErrorBase<{
    readonly file?: string | undefined;
    readonly issues: ReadonlyArray<{
        readonly path: string;
        readonly message: string;
    }>;
}>
```

Changeset file validation failure.

### Classification

```ts
interface Classification
```

The result of classifying a single path against a resolved config.

### ClassificationReason

```ts
type ClassificationReason = "workspace" | {
    readonly kind: "additionalScope";
    readonly glob: string;
} | {
    readonly kind: "versionFile";
    readonly glob: string;
} | null;
```

Reason a path was attributed to a particular package (or left unmapped).

### CommitHashSchema

```ts
CommitHashSchema: Schema.filter<typeof Schema.String>
```

Schema for a git commit hash (at least 7 lowercase hex characters).

### computeWorkspaceDependencyDiffs

```ts
function computeWorkspaceDependencyDiffs(beforeSnapshots: ReadonlyArray<WorkspaceSnapshot>, afterSnapshots: ReadonlyArray<WorkspaceSnapshot>): ReadonlyArray<WorkspaceDependencyDiff>;
```

Diff two workspace snapshots and return per-package dependency-table rows.

### ConfigInspector

```ts
class ConfigInspector extends ConfigInspectorBase
```

Effect service tag for ConfigInspectorShape.

### ConfigInspectorLive

```ts
ConfigInspectorLive: Layer.Layer<ConfigInspector, never, ChangesetConfigReader |
  WorkspaceDiscovery>
```

Live layer for ConfigInspector. Requires [ChangesetConfigReader](silk://packages/silk-effects/api/class/changesetconfigreader) and WorkspaceDiscovery in the environment.

### ConfigInspectorShape

```ts
interface ConfigInspectorShape
```

Effect service interface for inspecting a project's changeset config.

### ConfigurationError

```ts
class ConfigurationError extends ConfigurationErrorBase<{
    readonly field: string;
    readonly reason: string;
}>
```

Invalid or missing configuration.

### ContentStructureRule

```ts
ContentStructureRule: import("unified-lint-rule").Plugin<Root, unknown>
```

### ContributorFootnotesPlugin

```ts
ContributorFootnotesPlugin: Plugin<[], Root>
```

### DeduplicateItemsPlugin

```ts
DeduplicateItemsPlugin: Plugin<[], Root>
```

### DependencyAction

```ts
type DependencyAction = typeof DependencyActionSchema.Type;
```

Inferred type for DependencyActionSchema.

### DependencyActionSchema

```ts
DependencyActionSchema: Schema.Literal<["added", "updated", "removed"]>
```

Valid dependency table actions.

### DependencyTable

```ts
class DependencyTable
```

Static class for dependency table manipulation. Wraps the internal utility functions that operate on dependency tables -- the structured markdown tables that appear in the "Dependencies" section of changelogs. Each row in a dependency table represents a single package change with its name, type, action, and version transition.

### DependencyTableFormatRule

```ts
DependencyTableFormatRule: import("unified-lint-rule").Plugin<Root, unknown>
```

### DependencyTableRow

```ts
interface DependencyTableRow extends Schema.Schema.Type<typeof DependencyTableRowSchema>
```

Inferred type for DependencyTableRowSchema.

### DependencyTableRowSchema

```ts
DependencyTableRowSchema: Schema.Struct<{
    dependency: Schema.filter<typeof Schema.String>;
    type: Schema.Literal<["dependency", "devDependency", "peerDependency", "optionalDependency", "workspace", "config"]>;
    action: Schema.Literal<["added", "updated", "removed"]>;
    from: Schema.filter<typeof Schema.String>;
    to: Schema.filter<typeof Schema.String>;
}>
```

Schema for a single dependency table row.

### DependencyTableSchema

```ts
DependencyTableSchema: Schema.filter<Schema.Array$<Schema.Struct<{
    dependency: Schema.filter<typeof Schema.String>;
    type: Schema.Literal<["dependency", "devDependency", "peerDependency", "optionalDependency", "workspace", "config"]>;
    action: Schema.Literal<["added", "updated", "removed"]>;
    from: Schema.filter<typeof Schema.String>;
    to: Schema.filter<typeof Schema.String>;
}>>>
```

Schema for a dependency table (non-empty array of rows).

### DependencyTableType

```ts
type DependencyTableType = typeof DependencyTableTypeSchema.Type;
```

Inferred type for DependencyTableTypeSchema.

### DependencyTableTypeSchema

```ts
DependencyTableTypeSchema: Schema.Literal<["dependency", "devDependency", "peerDependency", "optionalDependency", "workspace", "config"]>
```

Extended dependency types for table format.

### DependencyType

```ts
type DependencyType = typeof DependencyTypeSchema.Type;
```

Inferred type for DependencyTypeSchema.

### DependencyTypeSchema

```ts
DependencyTypeSchema: Schema.Literal<["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]>
```

Schema for npm dependency types.

### DependencyUpdate

```ts
interface DependencyUpdate extends Schema.Schema.Type<typeof DependencyUpdateSchema>
```

Inferred type for DependencyUpdateSchema.

### DependencyUpdateSchema

```ts
DependencyUpdateSchema: Schema.Struct<{
    name: Schema.refine<string, typeof Schema.String>;
    type: Schema.Literal<["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]>;
    oldVersion: typeof Schema.String;
    newVersion: typeof Schema.String;
}>
```

Schema for a dependency update entry.

### FileStatus

```ts
type FileStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "typechange" | "unmerged" | "unknown";
```

Git diff status as reported by `--name-status`.

### GitError

```ts
class GitError extends GitErrorBase<{
    readonly command: string;
    readonly cwd: string;
    readonly reason: string;
}>
```

Git command failure.

### GitHubApiError

```ts
class GitHubApiError extends GitHubApiErrorBase<{
    readonly operation: string;
    readonly statusCode?: number | undefined;
    readonly reason: string;
}>
```

GitHub API request failure.

### GitHubCommitInfo

```ts
interface GitHubCommitInfo
```

Structured result from the GitHub commit info API.

### GitHubInfo

```ts
interface GitHubInfo extends Schema.Schema.Type<typeof GitHubInfoSchema>
```

Inferred type for GitHubInfoSchema.

### GitHubInfoSchema

```ts
GitHubInfoSchema: Schema.Struct<{
    user: Schema.optional<Schema.filter<typeof Schema.String>>;
    pull: Schema.optional<Schema.refine<number, Schema.filter<typeof Schema.Number>>>;
    links: Schema.Struct<{
        commit: Schema.filter<typeof Schema.String>;
        pull: Schema.optional<Schema.filter<typeof Schema.String>>;
        user: Schema.optional<Schema.filter<typeof Schema.String>>;
    }>;
}>
```

Schema for a GitHub info response from `\@changesets/get-github-info`.

### GitHubLive

```ts
GitHubLive: Layer.Layer<GitHubService, never, never>
```

Production layer for GitHubService. Delegates to `\@changesets/get-github-info` to fetch commit metadata from the GitHub REST API. Requires a `GITHUB_TOKEN` environment variable to be set for authenticated requests.

### GitHubService

```ts
class GitHubService extends GitHubServiceBase
```

Effect service tag for GitHub API operations. Provides dependency-injected access to GitHub commit metadata lookups. Use `yield* GitHubService` inside an `Effect.gen` block to obtain the service instance.

### GitHubServiceShape

```ts
interface GitHubServiceShape
```

Service interface for GitHub API operations. Describes the single `getInfo` operation that resolves a commit hash to its associated GitHub metadata (pull-request number, author, and links).

### GlobSchema

```ts
GlobSchema: Schema.filter<Schema.filter<typeof Schema.String>>
```

Schema for a single repo-relative glob pattern.

### HeadingHierarchyRule

```ts
HeadingHierarchyRule: import("unified-lint-rule").Plugin<Root, unknown>
```

### InspectedConfig

```ts
interface InspectedConfig
```

Structured representation of a resolved `.changeset/config.json` for consumers (CLI commands, agents, tests).

### IssueLinkRefsPlugin

```ts
IssueLinkRefsPlugin: Plugin<[], Root>
```

### IssueNumberSchema

```ts
IssueNumberSchema: Schema.refine<number, Schema.filter<typeof Schema.Number>>
```

Schema for a GitHub issue or PR number (positive integer).

### JsonPathSchema

```ts
JsonPathSchema: Schema.filter<typeof Schema.String>
```

Schema for a JSONPath expression starting with `$.`.

### LegacyVersionFileConfig

```ts
interface LegacyVersionFileConfig extends Schema.Schema.Type<typeof LegacyVersionFileConfigSchema>
```

Inferred type for LegacyVersionFileConfigSchema (deprecated shape).

### LegacyVersionFileConfigSchema

```ts
LegacyVersionFileConfigSchema: Schema.Struct<{
    glob: Schema.filter<typeof Schema.String>;
    paths: Schema.optional<Schema.Array$<Schema.filter<typeof Schema.String>>>;
    package: Schema.optional<Schema.filter<typeof Schema.String>>;
}>
```

Schema for a single version file configuration entry — **legacy shape**.

### LegacyVersionFilesSchema

```ts
LegacyVersionFilesSchema: Schema.Array$<Schema.Struct<{
    glob: Schema.filter<typeof Schema.String>;
    paths: Schema.optional<Schema.Array$<Schema.filter<typeof Schema.String>>>;
    package: Schema.optional<Schema.filter<typeof Schema.String>>;
}>>
```

Schema for an array of legacy LegacyVersionFileConfigSchema entries — used by the deprecated top-level `versionFiles[]` array on `ChangesetOptionsSchema`.

### LintMessage

```ts
interface LintMessage
```

A single lint diagnostic message produced by changeset validation.

### listPublishablePackageNames

```ts
function listPublishablePackageNames(packages: ReadonlyArray<WorkspacePackage>): Effect.Effect<ReadonlySet<string>, never, PublishabilityDetector>;
```

Compute the set of currently-publishable workspace package names.

### makeBranchAnalyzerTest

```ts
function makeBranchAnalyzerTest(fixed: BranchAnalysis): Layer.Layer<BranchAnalyzer>;
```

Test factory — build a BranchAnalyzer that returns a fixed BranchAnalysis for any input.

### makeConfigInspectorTest

```ts
function makeConfigInspectorTest(fixed: InspectedConfig): Layer.Layer<ConfigInspector>;
```

Test factory — build a ConfigInspector that returns a fixed InspectedConfig without touching the filesystem. Tests that need to exercise the inspect/classify logic against real files should compose `ConfigInspectorLive` with test layers for `ChangesetConfigReader` and `WorkspaceDiscovery` instead.

### makeGitHubTest

```ts
function makeGitHubTest(responses: Map<string, GitHubCommitInfo>): Layer.Layer<GitHubService>;
```

Create a test layer for GitHubService with pre-configured responses. Returns a `Layer` that resolves commit hashes from the provided `Map`. Lookups for commits not present in the map fail with a GitHubApiError.

### MarkdownlintContentStructureRule

```ts
ContentStructureRule: Rule
```

markdownlint rule: `changeset-content-structure` (CSH003). Validates content quality inside changeset markdown files by inspecting micromark tokens for three categories of structural problems: 1. **Empty sections** -- an `atxHeading` (h2) followed immediately by another h2 or the end of the token stream with no intervening content tokens. 2. **Code blocks without a language identifier** -- a `codeFenced` token whose opening fence child lacks a `codeFencedFenceInfo` token. 3. **Empty list items** -- a `listItemPrefix` token with no subsequent `content` token before the next prefix or end of list.

### MarkdownlintDependencyTableFormatRule

```ts
DependencyTableFormatRule: Rule
```

The markdownlint `Rule` object for CSH005 (`changeset-dependency-table-format`).

### MarkdownlintHeadingHierarchyRule

```ts
HeadingHierarchyRule: Rule
```

markdownlint rule: `changeset-heading-hierarchy` (CSH001). Validates heading structure in changeset markdown files by inspecting `atxHeading` micromark tokens for three constraints: 1. **No h1 headings** -- h1 is reserved for the version title generated by the changelog formatter. 2. **Start at h2** -- the first heading in a changeset must be h2. 3. **No depth skips** -- heading levels must increase sequentially (h2 then h3, not h2 then h4).

### MarkdownlintRequiredSectionsRule

```ts
RequiredSectionsRule: Rule
```

markdownlint rule: `changeset-required-sections` (CSH002). Validates that every h2 (`atxHeading` with depth 2) in a changeset markdown file matches a known category heading from the category system. When an unrecognized heading is found, the error detail lists all valid headings.

### MarkdownlintUncategorizedContentRule

```ts
UncategorizedContentRule: Rule
```

markdownlint rule: `changeset-uncategorized-content` (CSH004). Detects content that appears before the first h2 heading in a changeset markdown file. All substantive content must be placed under a categorized section (`## heading`).

### MarkdownLive

```ts
MarkdownLive: Layer.Layer<MarkdownService, never, never>
```

Production layer for MarkdownService. Wraps the remark-pipeline utility functions (`parseMarkdown` and `stringifyMarkdown`) in `Effect.sync` for use in Effect programs. Both operations are synchronous and infallible.

### MarkdownParseError

```ts
class MarkdownParseError extends MarkdownParseErrorBase<{
    readonly source?: string | undefined;
    readonly reason: string;
    readonly line?: number | undefined;
    readonly column?: number | undefined;
}>
```

Markdown parsing failure.

### MarkdownService

```ts
class MarkdownService extends MarkdownServiceBase
```

Effect service tag for markdown parsing and stringification. Provides dependency-injected access to markdown parse/stringify operations. Use `yield* MarkdownService` inside an `Effect.gen` block to obtain the service instance.

### MarkdownServiceShape

```ts
interface MarkdownServiceShape
```

Service interface for markdown parsing and stringification. Describes the two operations a `MarkdownService` implementation must provide: parsing markdown text into an mdast AST and stringifying an mdast AST back to markdown text.

### MergeSectionsPlugin

```ts
MergeSectionsPlugin: Plugin<[], Root>
```

### NonEmptyString

```ts
NonEmptyString: Schema.filter<typeof Schema.String>
```

A non-empty string schema.

### NormalizeFormatPlugin

```ts
NormalizeFormatPlugin: Plugin<[], Root>
```

### PackageScope

```ts
interface PackageScope extends Schema.Schema.Type<typeof PackageScopeSchema>
```

Inferred type for PackageScopeSchema.

### PackageScopeSchema

```ts
PackageScopeSchema: Schema.Struct<{
    additionalScopes: Schema.optional<Schema.Array$<Schema.filter<Schema.filter<typeof Schema.String>>>>;
    versionFiles: Schema.optional<Schema.Array$<Schema.Struct<{
        glob: Schema.filter<typeof Schema.String>;
        paths: Schema.optional<Schema.Array$<Schema.filter<typeof Schema.String>>>;
    }>>>;
}>
```

Schema for a single entry in the `packages` record — the per-package release-surface declaration.

### PackagesRecordSchema

```ts
PackagesRecordSchema: Schema.Record$<typeof Schema.String, Schema.Struct<{
    additionalScopes: Schema.optional<Schema.Array$<Schema.filter<Schema.filter<typeof Schema.String>>>>;
    versionFiles: Schema.optional<Schema.Array$<Schema.Struct<{
        glob: Schema.filter<typeof Schema.String>;
        paths: Schema.optional<Schema.Array$<Schema.filter<typeof Schema.String>>>;
    }>>>;
}>>
```

Schema for the `packages` record on the changelog options.

### PositiveInteger

```ts
PositiveInteger: Schema.filter<Schema.filter<typeof Schema.Number>>
```

A positive integer schema.

### ReorderSectionsPlugin

```ts
ReorderSectionsPlugin: Plugin<[], Root>
```

### RepoSchema

```ts
RepoSchema: Schema.filter<typeof Schema.String>
```

Schema for a GitHub repository in `owner/repo` format.

### RequiredSectionsRule

```ts
RequiredSectionsRule: import("unified-lint-rule").Plugin<Root, unknown>
```

### ResolvedPackageScope

```ts
interface ResolvedPackageScope
```

A package's release surface after the config has been resolved against the workspace and the globs have been materialized.

### ResolvedVersionFile

```ts
interface ResolvedVersionFile
```

A `versionFiles` entry expanded to its absolute target paths.

### SectionCategory

```ts
interface SectionCategory extends Schema.Schema.Type<typeof SectionCategorySchema>
```

A section category defines how changes are grouped in release notes.

### SectionCategorySchema

```ts
SectionCategorySchema: Schema.Struct<{
    heading: typeof Schema.String;
    priority: typeof Schema.Number;
    commitTypes: Schema.Array$<typeof Schema.String>;
    description: typeof Schema.String;
}>
```

Schema for a section category that defines how changes are grouped in release notes.

### SilkChangesetPreset

```ts
SilkChangesetPreset: readonly [import("unified-lint-rule").Plugin<import("mdast").Root, unknown>, import("unified-lint-rule").Plugin<import("mdast").Root, unknown>, import("unified-lint-rule").Plugin<import("mdast").Root, unknown>, import("unified-lint-rule").Plugin<import("mdast").Root, unknown>, import("unified-lint-rule").Plugin<import("mdast").Root, unknown>]
```

Preset combining all changeset lint rules for convenient consumption.

### SilkChangesetsRules

```ts
SilkChangesetsRules: Rule[]
```

All changeset rules as an array for markdownlint-cli2 `customRules` config.

### SilkChangesetTransformPreset

```ts
SilkChangesetTransformPreset: readonly [import("unified").Plugin<[], import("mdast").Root>, import("unified").Plugin<[], import("mdast").Root>, import("unified").Plugin<[], import("mdast").Root>, import("unified").Plugin<[], import("mdast").Root>, import("unified").Plugin<[], import("mdast").Root>, import("unified").Plugin<[], import("mdast").Root>, import("unified").Plugin<[], import("mdast").Root>]
```

Ordered array of all transform plugins in the correct execution order.

### UncategorizedContentRule

```ts
UncategorizedContentRule: import("unified-lint-rule").Plugin<Root, unknown>
```

### UrlOrMarkdownLinkSchema

```ts
UrlOrMarkdownLinkSchema: Schema.filter<typeof Schema.String>
```

Schema accepting either a plain URL or a markdown link `[text](url)`.

### UsernameSchema

```ts
UsernameSchema: Schema.filter<typeof Schema.String>
```

Schema for a GitHub username.

### VersionFileConfig

```ts
interface VersionFileConfig extends Schema.Schema.Type<typeof VersionFileConfigSchema>
```

Inferred type for VersionFileConfigSchema (new shape).

### VersionFileConfigSchema

```ts
VersionFileConfigSchema: Schema.Struct<{
    glob: Schema.filter<typeof Schema.String>;
    paths: Schema.optional<Schema.Array$<Schema.filter<typeof Schema.String>>>;
}>
```

Schema for a single version file configuration entry — **new shape**.

### VersionFileError

```ts
class VersionFileError extends VersionFileErrorBase<{
    readonly filePath: string;
    readonly jsonPath?: string | undefined;
    readonly reason: string;
}>
```

Version file update failure.

### VersionFilesSchema

```ts
VersionFilesSchema: Schema.Array$<Schema.Struct<{
    glob: Schema.filter<typeof Schema.String>;
    paths: Schema.optional<Schema.Array$<Schema.filter<typeof Schema.String>>>;
}>>
```

Schema for an array of new-shape VersionFileConfigSchema entries.

### VersionOrEmptySchema

```ts
VersionOrEmptySchema: Schema.filter<typeof Schema.String>
```

Version string or em dash (U+2014) sentinel for added/removed entries.

### VersionType

```ts
type VersionType = typeof VersionTypeSchema.Type;
```

Inferred type for VersionTypeSchema.

### VersionTypeSchema

```ts
VersionTypeSchema: Schema.Literal<["major", "minor", "patch", "none"]>
```

Semantic version bump type.

### WorkspaceDependencyDiff

```ts
interface WorkspaceDependencyDiff
```

A workspace package's worth of dependency-table rows.

### WorkspaceSnapshot

```ts
interface WorkspaceSnapshot
```

One workspace package as it existed at a specific git ref.

### WorkspaceSnapshotReader

```ts
class WorkspaceSnapshotReader extends WorkspaceSnapshotReaderBase
```

Effect service tag for WorkspaceSnapshotReaderShape.

### WorkspaceSnapshotReaderLive

```ts
WorkspaceSnapshotReaderLive: Layer.Layer<WorkspaceSnapshotReader>
```

Production layer for WorkspaceSnapshotReader.

### WorkspaceSnapshotReaderShape

```ts
interface WorkspaceSnapshotReaderShape
```

Effect service interface for reading workspace snapshots.

### WorkspaceVersion

```ts
interface WorkspaceVersion
```

A discovered workspace package with its version.
