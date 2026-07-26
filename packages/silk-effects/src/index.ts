/**
 * `@savvy-web/silk-effects` — shared Effect library for Silk Suite conventions.
 *
 * @remarks
 * Platform-agnostic Effect services for publishability detection, workspace
 * analysis, managed sections, config discovery, and Biome schema
 * synchronization. Versioning and tag classification are `@effected/workspaces`
 * value classes (`VersioningStrategy`, `ReleaseTag`, `TagStyle`), imported from
 * the kit directly rather than re-exported here — the same posture as
 * `PublishTarget` on {@link AnalyzedWorkspace}. Consumers provide their platform
 * layer (NodeContext, BunContext, etc.).
 *
 * @packageDocumentation
 */

/**
 * Section-aware changesets business logic — config inspection, branch analysis,
 * changeset linting, and release planning over the genuine `@changesets` engine.
 *
 * @public
 */
export * as Changesets from "./changesets/index.js";
// Flat re-export so a generated commitlint.config.ts can name the inferred
// default-export type (CommitlintConfig.silk()) for declaration emit. The three
// nested types are reachable from CommitlintUserConfig's fields, so the entry must
// expose them flat too or api-extractor reports them as forgotten exports.
export type {
	CommitlintPlugin,
	CommitlintUserConfig,
	PromptConfig,
	PromptSettings,
	RuleApplicability,
	RuleConfigTuple,
	RuleSeverity,
	RulesConfig,
} from "./commitlint/index.js";
/**
 * Commitlint rules and config for Silk conventional commits, including the
 * `silk/body-no-markdown` rule.
 *
 * @public
 */
export * as Commitlint from "./commitlint/index.js";
// ── Errors ─────────────────────────────────────────────────────
export { BiomeSyncError } from "./errors/BiomeSyncError.js";
export { ChangesetConfigError } from "./errors/ChangesetConfigError.js";
export { ConfigNotFoundError } from "./errors/ConfigNotFoundError.js";
export { PublishTargetBindingError } from "./errors/PublishTargetBindingError.js";
export { WorkspaceAnalysisError } from "./errors/WorkspaceAnalysisError.js";
/**
 * Lint orchestration business logic — Biome and markdownlint configuration and
 * workspace-aware execution.
 *
 * @public
 */
export * as Lint from "./lint/index.js";
/**
 * Vendored reference repos: the .repos/config.json manifest, submodule plumbing, and drift reporting.
 * @public
 */
export * as Repos from "./repos/index.js";
// ── Schemas ────────────────────────────────────────────────────
export type { BiomeSyncOptions, BiomeSyncResult } from "./schemas/BiomeConfig.js";
export type { ConfigDiscoveryOptions, ConfigLocation, ConfigSource } from "./schemas/ConfigDiscoverySchemas.js";
export {
	SavvyBaseSection,
	SavvyHooksSection,
	savvyBasePreamble,
	savvyHooksHygiene,
	savvyToolSection,
} from "./schemas/SavvySections.js";
export type { ChangesetConfigFile, SilkChangesetConfigFile } from "./schemas/VersioningSchemas.js";
export { AnalyzedWorkspace, SilkPublishConfig, WorkspaceAnalysis } from "./schemas/WorkspaceAnalysisSchemas.js";
// ── Services ───────────────────────────────────────────────────
export type { BiomeSchemaSyncShape } from "./services/BiomeSchemaSync.js";
export { BiomeSchemaSync, BiomeSchemaSyncLive, buildSchemaUrl, extractSemver } from "./services/BiomeSchemaSync.js";
export type { ChangesetConfigShape, ChangesetMode } from "./services/ChangesetConfig.js";
export { ChangesetConfig, ChangesetConfigLive } from "./services/ChangesetConfig.js";
export type { ChangesetConfigReaderShape } from "./services/ChangesetConfigReader.js";
export { ChangesetConfigReader, ChangesetConfigReaderLive } from "./services/ChangesetConfigReader.js";
export type { ConfigDiscoveryShape } from "./services/ConfigDiscovery.js";
export { ConfigDiscovery, ConfigDiscoveryLive } from "./services/ConfigDiscovery.js";
export type {
	PublishablePackage,
	RawPackageJson,
	RawPublishConfig,
	RawPublishTargets,
	RawTargetObject,
	RawTargetValue,
	TargetBinding,
	TargetGroupBinding,
	TargetsBinding,
} from "./services/SilkPublishability.js";
export {
	PublishabilityDetectorAdaptiveLive,
	SilkPublishability,
	SilkPublishabilityDetectorLive,
	readTargetsBinding,
} from "./services/SilkPublishability.js";
export type { SilkWorkspaceAnalyzerShape } from "./services/SilkWorkspaceAnalyzer.js";
export { SilkWorkspaceAnalyzer, SilkWorkspaceAnalyzerLive } from "./services/SilkWorkspaceAnalyzer.js";
/**
 * Read-only Turborepo inspection — cache diagnosis, task-graph, and affected-set
 * analysis. All operations are `--dry`; tasks are never executed.
 *
 * @public
 */
export * as Turbo from "./turbo/index.js";
