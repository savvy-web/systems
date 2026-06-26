---
id: packages/silk-effects/api
title: "@savvy-web/silk-effects — API reference"
summary: "@savvy-web/silk-effects API reference: 114 documented symbols."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.4
related: []
---

# @savvy-web/silk-effects — API reference

## class

- [`AnalyzedWorkspace`](silk://packages/silk-effects/api/class/analyzedworkspace) — A fully analyzed workspace with publish targets, versioning status, and release group membership.
- [`BiomeSchemaSync`](silk://packages/silk-effects/api/class/biomeschemasync) — Service that keeps the `$schema` URL in Biome config files in sync with a target version.
- [`BiomeSyncError`](silk://packages/silk-effects/api/class/biomesyncerror) — Raised when a Biome config file cannot be read or its `$schema` URL cannot be updated.
- [`ChangesetConfig`](silk://packages/silk-effects/api/class/changesetconfig) — Accessor service over a workspace root's `.changeset/config.json`.
- [`ChangesetConfigError`](silk://packages/silk-effects/api/class/changesetconfigerror) — Raised when the `.changeset/config.json` file cannot be read or decoded.
- [`ChangesetConfigReader`](silk://packages/silk-effects/api/class/changesetconfigreader) — Service that reads and decodes the `.changeset/config.json` for a given workspace root.
- [`ConfigDiscovery`](silk://packages/silk-effects/api/class/configdiscovery) — Service that locates named config files within a workspace using priority-ordered search paths.
- [`ConfigNotFoundError`](silk://packages/silk-effects/api/class/confignotfounderror) — Raised when a config file cannot be located in any of the expected locations.
- [`ManagedSection`](silk://packages/silk-effects/api/class/managedsection) — Service for managing delimited sections in user-editable files. All methods use dual API (data-first and data-last). Identity-only operations (`read`, `isManaged`) take a SectionDefinition. Content operations (`write`, `sync`, `check`) take a SectionBlock.
- [`ResolvedTool`](silk://packages/silk-effects/api/class/resolvedtool) — Result of resolving a ToolDefinition. Provides `exec` and `dlx` to build commands for the resolved tool.
- [`SectionBlock`](silk://packages/silk-effects/api/class/sectionblock) — The content between managed section markers. `Equal` compares normalized content only (trimmed, whitespace-collapsed). Use `diff` to compute line-level differences.
- [`SectionDefinition`](silk://packages/silk-effects/api/class/sectiondefinition) — Identity envelope for a managed section type. `Equal` compares on `toolName` + `commentStyle`. Use to create a SectionBlock, or `generate()` for a typed factory.
- [`SectionParseError`](silk://packages/silk-effects/api/class/sectionparseerror) — Raised when a managed section cannot be parsed from a file.
- [`SectionValidationError`](silk://packages/silk-effects/api/class/sectionvalidationerror) — Raised when a SectionBlock fails validation at creation time.
- [`SectionWriteError`](silk://packages/silk-effects/api/class/sectionwriteerror) — Raised when a managed section cannot be written to a file.
- [`ShellSectionDefinition`](silk://packages/silk-effects/api/class/shellsectiondefinition) — Convenience section definition for shell hooks. `commentStyle` is always `"#"` — only `toolName` is required.
- [`SilkPublishability`](silk://packages/silk-effects/api/class/silkpublishability) — Silk publishability rules over `workspaces-effect`'s `PublishTarget`.
- [`SilkPublishConfig`](silk://packages/silk-effects/api/class/silkpublishconfig) — Silk-extended publishConfig schema.
- [`SilkWorkspaceAnalyzer`](silk://packages/silk-effects/api/class/silkworkspaceanalyzer) — Service that performs a full workspace analysis — discovering packages, detecting publishability, computing versioning/tag strategies, and wiring up fixed/linked release groups.
- [`TagFormatError`](silk://packages/silk-effects/api/class/tagformaterror) — Raised when a git tag string cannot be formatted for the given package name and version.
- [`TagStrategy`](silk://packages/silk-effects/api/class/tagstrategy) — Service that determines and applies the git-tag naming strategy for a release.
- [`ToolCommand`](silk://packages/silk-effects/api/class/toolcommand) — Wraps `@effect/platform` `Command.Command` with instance method ergonomics. Use `yield* cmd.string()` instead of `yield* Command.string(cmd)`.
- [`ToolDefinition`](silk://packages/silk-effects/api/class/tooldefinition) — Declares a CLI tool's identity and resolution constraints. `Equal` compares on `name` only (identity).
- [`ToolDiscovery`](silk://packages/silk-effects/api/class/tooldiscovery) — Service that resolves CLI tools — locating them globally (PATH) or locally (via package manager), extracting versions, enforcing source and version constraints, and caching results.
- [`ToolNotFoundError`](silk://packages/silk-effects/api/class/toolnotfounderror)
- [`ToolResolutionError`](silk://packages/silk-effects/api/class/toolresolutionerror)
- [`ToolVersionMismatchError`](silk://packages/silk-effects/api/class/toolversionmismatcherror)
- [`VersioningDetectionError`](silk://packages/silk-effects/api/class/versioningdetectionerror) — Raised when the versioning strategy cannot be determined from the workspace state.
- [`VersioningStrategy`](silk://packages/silk-effects/api/class/versioningstrategy) — Service that classifies the versioning strategy used by a workspace.
- [`WorkspaceAnalysis`](silk://packages/silk-effects/api/class/workspaceanalysis) — Full workspace analysis result containing all analyzed workspaces and project-level configuration.
- [`WorkspaceAnalysisError`](silk://packages/silk-effects/api/class/workspaceanalysiserror) — Raised when workspace analysis fails for a given root directory.

## function

- [`buildSchemaUrl`](silk://packages/silk-effects/api/function/buildschemaurl) — Build the expected Biome JSON schema URL for a given version.
- [`extractSemver`](silk://packages/silk-effects/api/function/extractsemver) — Strip leading semver range operators from a version string.
- [`readTargetsBinding`](silk://packages/silk-effects/api/function/readtargetsbinding) — Read the bundler's `<pkgPath>/dist/prod/targets.json` binding via FileSystem.
- [`savvyBasePreamble`](silk://packages/silk-effects/api/function/savvybasepreamble) — Package-manager detection preamble shared across Silk Suite hook files.
- [`savvyHooksHygiene`](silk://packages/silk-effects/api/function/savvyhookshygiene) — Repo-hygiene block shared across Silk Suite hook files.
- [`savvyToolSection`](silk://packages/silk-effects/api/function/savvytoolsection) — Build a consumer's one-line tool section so every consumer calls the shared base helpers identically.

## interface

- [`CommitlintPlugin`](silk://packages/silk-effects/api/interface/commitlintplugin) — Commitlint plugin interface.
- [`CommitlintUserConfig`](silk://packages/silk-effects/api/interface/commitlintuserconfig) — Commitlint user configuration.
- [`PromptConfig`](silk://packages/silk-effects/api/interface/promptconfig) — Commitlint prompt configuration.
- [`PromptSettings`](silk://packages/silk-effects/api/interface/promptsettings) — Commitlint prompt settings.
- [`PublishablePackage`](silk://packages/silk-effects/api/interface/publishablepackage) — A publishable workspace package and the count of its resolved publish targets.
- [`RawPackageJson`](silk://packages/silk-effects/api/interface/rawpackagejson) — Raw `package.json` shape consumed by `SilkPublishability.detect`.
- [`RawPublishConfig`](silk://packages/silk-effects/api/interface/rawpublishconfig) — Raw `publishConfig` shape (the unschematized fields silk rules consult).
- [`RawTargetObject`](silk://packages/silk-effects/api/interface/rawtargetobject) — A single object-form publish target in the `publishConfig.targets` map (mirrors the bundler's `PublishTargetObject`).
- [`RulesConfig`](silk://packages/silk-effects/api/interface/rulesconfig) — Commitlint rules configuration.
- [`TargetBinding`](silk://packages/silk-effects/api/interface/targetbinding) — A resolved registry target from the bundler's `dist/prod/targets.json` binding (one per `publishConfig.targets` key).
- [`TargetGroupBinding`](silk://packages/silk-effects/api/interface/targetgroupbinding) — A resolved byte-variant group from the bundler's `dist/prod/targets.json` binding.
- [`TargetsBinding`](silk://packages/silk-effects/api/interface/targetsbinding) — The `dist/prod/targets.json` binding the bundler emits for the release action to consume.

## namespace

- [`Changesets`](silk://packages/silk-effects/api/namespace/changesets)
- [`Commitlint`](silk://packages/silk-effects/api/namespace/commitlint)
- [`Lint`](silk://packages/silk-effects/api/namespace/lint)
- [`Turbo`](silk://packages/silk-effects/api/namespace/turbo)

## type

- [`BiomeSyncOptions`](silk://packages/silk-effects/api/type/biomesyncoptions)
- [`BiomeSyncResult`](silk://packages/silk-effects/api/type/biomesyncresult)
- [`ChangesetConfigFile`](silk://packages/silk-effects/api/type/changesetconfigfile)
- [`ChangesetMode`](silk://packages/silk-effects/api/type/changesetmode) — Changeset operating mode for a workspace root.
- [`CheckResult`](silk://packages/silk-effects/api/type/checkresult)
- [`CheckResultDefinition`](silk://packages/silk-effects/api/type/checkresultdefinition) — Result of a check operation.
- [`CommentStyle`](silk://packages/silk-effects/api/type/commentstyle)
- [`ConfigDiscoveryOptions`](silk://packages/silk-effects/api/type/configdiscoveryoptions)
- [`ConfigLocation`](silk://packages/silk-effects/api/type/configlocation)
- [`ConfigSource`](silk://packages/silk-effects/api/type/configsource)
- [`RawPublishTargets`](silk://packages/silk-effects/api/type/rawpublishtargets) — The `publishConfig.targets` map, keyed by target id (`npm`, `github`, or a custom key).
- [`RawTargetValue`](silk://packages/silk-effects/api/type/rawtargetvalue) — A `publishConfig.targets` value: `true` (well-known registry, base name), a string (name override), or an object.
- [`ResolutionPolicy`](silk://packages/silk-effects/api/type/resolutionpolicy)
- [`ResolutionPolicyDefinition`](silk://packages/silk-effects/api/type/resolutionpolicydefinition) — What to do when both global and local versions differ.
- [`RuleApplicability`](silk://packages/silk-effects/api/type/ruleapplicability) — Rule applicability.
- [`RuleConfigTuple`](silk://packages/silk-effects/api/type/ruleconfigtuple) — Rule configuration tuple.
- [`RuleSeverity`](silk://packages/silk-effects/api/type/ruleseverity) — Rule severity level. - 0: Disabled - 1: Warning - 2: Error
- [`SectionDiff`](silk://packages/silk-effects/api/type/sectiondiff)
- [`SectionDiffDefinition`](silk://packages/silk-effects/api/type/sectiondiffdefinition) — Result of comparing two section contents.
- [`SilkChangesetConfigFile`](silk://packages/silk-effects/api/type/silkchangesetconfigfile)
- [`SourceRequirement`](silk://packages/silk-effects/api/type/sourcerequirement)
- [`SourceRequirementDefinition`](silk://packages/silk-effects/api/type/sourcerequirementdefinition) — Where the tool must be found.
- [`SyncResult`](silk://packages/silk-effects/api/type/syncresult)
- [`SyncResultDefinition`](silk://packages/silk-effects/api/type/syncresultdefinition) — Result of a sync operation.
- [`TagStrategyType`](silk://packages/silk-effects/api/type/tagstrategytype)
- [`ToolSource`](silk://packages/silk-effects/api/type/toolsource)
- [`VersionExtractor`](silk://packages/silk-effects/api/type/versionextractor)
- [`VersionExtractorDefinition`](silk://packages/silk-effects/api/type/versionextractordefinition) — How to extract a version string from a CLI tool.
- [`VersioningStrategyResult`](silk://packages/silk-effects/api/type/versioningstrategyresult)
- [`VersioningStrategyType`](silk://packages/silk-effects/api/type/versioningstrategytype)

## variable

- [`BiomeSchemaSyncLive`](silk://packages/silk-effects/api/variable/biomeschemasynclive) — Live implementation of BiomeSchemaSync.
- [`BiomeSyncOptions`](silk://packages/silk-effects/api/variable/biomesyncoptions) — Options for BiomeSchemaSync operations.
- [`BiomeSyncResult`](silk://packages/silk-effects/api/variable/biomesyncresult) — Result of a Biome schema URL sync or check operation.
- [`ChangesetConfigFile`](silk://packages/silk-effects/api/variable/changesetconfigfile)
- [`ChangesetConfigLive`](silk://packages/silk-effects/api/variable/changesetconfiglive) — Live ChangesetConfig reading via ChangesetConfigReader, cached per root.
- [`ChangesetConfigReaderLive`](silk://packages/silk-effects/api/variable/changesetconfigreaderlive) — Live implementation of ChangesetConfigReader.
- [`CheckResult`](silk://packages/silk-effects/api/variable/checkresult)
- [`CommentStyle`](silk://packages/silk-effects/api/variable/commentstyle) — Comment syntax used to write managed section markers.
- [`ConfigDiscoveryLive`](silk://packages/silk-effects/api/variable/configdiscoverylive) — Live implementation of ConfigDiscovery.
- [`ConfigDiscoveryOptions`](silk://packages/silk-effects/api/variable/configdiscoveryoptions) — Options passed to config discovery methods.
- [`ConfigLocation`](silk://packages/silk-effects/api/variable/configlocation) — The resolved location of a discovered config file.
- [`ConfigSource`](silk://packages/silk-effects/api/variable/configsource) — The discovery strategy used to locate a config file.
- [`ManagedSectionLive`](silk://packages/silk-effects/api/variable/managedsectionlive) — Live implementation of ManagedSection backed by `@effect/platform` FileSystem.
- [`PublishabilityDetectorAdaptiveLive`](silk://packages/silk-effects/api/variable/publishabilitydetectoradaptivelive) — Ignore-aware override of SilkPublishability. `detect` short-circuits to `[]` for changeset-ignored packages, then dispatches on `ChangesetConfig.mode`: `none` → `[]`; `silk` → `SilkPublishability.detect`; `vanilla` → the library default.
- [`ResolutionPolicy`](silk://packages/silk-effects/api/variable/resolutionpolicy)
- [`SavvyBaseSection`](silk://packages/silk-effects/api/variable/savvybasesection) — Section identity for the shared package-manager preamble. `toolName` is `"savvy-base"`; pair with savvyBasePreamble to build the block:
- [`SavvyHooksSection`](silk://packages/silk-effects/api/variable/savvyhookssection) — Section identity for the shared repo-hygiene block. `toolName` is `"savvy-hooks"`; pair with savvyHooksHygiene.
- [`SectionDiff`](silk://packages/silk-effects/api/variable/sectiondiff)
- [`SilkChangesetConfigFile`](silk://packages/silk-effects/api/variable/silkchangesetconfigfile)
- [`SilkPublishabilityDetectorLive`](silk://packages/silk-effects/api/variable/silkpublishabilitydetectorlive) — Override of `workspaces-effect`'s SilkPublishability Tag with pure silk rules.
- [`SilkWorkspaceAnalyzerLive`](silk://packages/silk-effects/api/variable/silkworkspaceanalyzerlive) — Live implementation of SilkWorkspaceAnalyzer.
- [`SourceRequirement`](silk://packages/silk-effects/api/variable/sourcerequirement)
- [`SyncResult`](silk://packages/silk-effects/api/variable/syncresult)
- [`TagStrategyLive`](silk://packages/silk-effects/api/variable/tagstrategylive) — Live implementation of TagStrategy with no external dependencies.
- [`TagStrategyType`](silk://packages/silk-effects/api/variable/tagstrategytype) — Git tag naming strategy for a workspace.
- [`ToolDiscoveryLive`](silk://packages/silk-effects/api/variable/tooldiscoverylive) — Live implementation of ToolDiscovery.
- [`ToolSource`](silk://packages/silk-effects/api/variable/toolsource) — Where a tool was resolved from.
- [`VersionExtractor`](silk://packages/silk-effects/api/variable/versionextractor)
- [`VersioningStrategyLive`](silk://packages/silk-effects/api/variable/versioningstrategylive) — Live implementation of VersioningStrategy.
- [`VersioningStrategyResult`](silk://packages/silk-effects/api/variable/versioningstrategyresult) — Output of the versioning strategy detection, combining the strategy type with group metadata.
- [`VersioningStrategyType`](silk://packages/silk-effects/api/variable/versioningstrategytype) — Versioning strategy classification for a workspace.
