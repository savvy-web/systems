/**
 * `@savvy-web/silk-effects` — shared Effect library for Silk Suite conventions.
 *
 * @remarks
 * Platform-agnostic Effect services for publishability detection, versioning strategy,
 * tag strategy, managed sections, config discovery, and Biome schema synchronization.
 * Consumers provide their platform layer (NodeContext, BunContext, etc.).
 *
 * @packageDocumentation
 */

// ── Errors ─────────────────────────────────────────────────────
export { BiomeSyncError } from "./errors/BiomeSyncError.js";
export { ChangesetConfigError } from "./errors/ChangesetConfigError.js";
export { ConfigNotFoundError } from "./errors/ConfigNotFoundError.js";
export { SectionParseError } from "./errors/SectionParseError.js";
export { SectionValidationError } from "./errors/SectionValidationError.js";
export { SectionWriteError } from "./errors/SectionWriteError.js";
export { TagFormatError } from "./errors/TagFormatError.js";
export { ToolNotFoundError } from "./errors/ToolNotFoundError.js";
export { ToolResolutionError } from "./errors/ToolResolutionError.js";
export { ToolVersionMismatchError } from "./errors/ToolVersionMismatchError.js";
export { VersioningDetectionError } from "./errors/VersioningDetectionError.js";
export { WorkspaceAnalysisError } from "./errors/WorkspaceAnalysisError.js";

// ── Schemas ────────────────────────────────────────────────────
export type { BiomeSyncOptions, BiomeSyncResult } from "./schemas/BiomeConfig.js";
export type { CommentStyle } from "./schemas/CommentStyle.js";
export type { ConfigDiscoveryOptions, ConfigLocation, ConfigSource } from "./schemas/ConfigDiscoverySchemas.js";
// ── Schemas (tools) ───────────────────────────────────────────
export { ResolvedTool } from "./schemas/ResolvedTool.js";
export { SectionBlock } from "./schemas/SectionBlock.js";
export { SectionDefinition, ShellSectionDefinition } from "./schemas/SectionDefinition.js";
export type { CheckResultDefinition, SectionDiffDefinition, SyncResultDefinition } from "./schemas/SectionResults.js";
export { CheckResult, SectionDiff, SyncResult } from "./schemas/SectionResults.js";
export type { TagStrategyType } from "./schemas/TagStrategySchemas.js";
export { ToolDefinition } from "./schemas/ToolDefinition.js";
export type {
	ResolutionPolicyDefinition,
	SourceRequirementDefinition,
	VersionExtractorDefinition,
} from "./schemas/ToolResults.js";
export { ResolutionPolicy, SourceRequirement, ToolSource, VersionExtractor } from "./schemas/ToolResults.js";
export type {
	ChangesetConfigFile,
	SilkChangesetConfigFile,
	VersioningStrategyResult,
	VersioningStrategyType,
} from "./schemas/VersioningSchemas.js";
export { AnalyzedWorkspace, SilkPublishConfig, WorkspaceAnalysis } from "./schemas/WorkspaceAnalysisSchemas.js";
// ── Services ───────────────────────────────────────────────────
export { BiomeSchemaSync, BiomeSchemaSyncLive, buildSchemaUrl, extractSemver } from "./services/BiomeSchemaSync.js";
export type { ChangesetMode } from "./services/ChangesetConfig.js";
export { ChangesetConfig, ChangesetConfigLive } from "./services/ChangesetConfig.js";
export { ChangesetConfigReader, ChangesetConfigReaderLive } from "./services/ChangesetConfigReader.js";
export { ConfigDiscovery, ConfigDiscoveryLive } from "./services/ConfigDiscovery.js";
export { ManagedSection, ManagedSectionLive } from "./services/ManagedSection.js";
export type {
	PublishablePackage,
	RawPackageJson,
	RawPublishConfig,
	RawTargetSpec,
} from "./services/SilkPublishability.js";
export {
	PublishabilityDetectorAdaptiveLive,
	SilkPublishability,
	SilkPublishabilityDetectorLive,
} from "./services/SilkPublishability.js";
export { SilkWorkspaceAnalyzer, SilkWorkspaceAnalyzerLive } from "./services/SilkWorkspaceAnalyzer.js";
export { TagStrategy, TagStrategyLive } from "./services/TagStrategy.js";
export { ToolDiscovery, ToolDiscoveryLive } from "./services/ToolDiscovery.js";
export { VersioningStrategy, VersioningStrategyLive } from "./services/VersioningStrategy.js";

// ── Utils ─────────────────────────────────────────────────────
export { ToolCommand } from "./utils/ToolCommand.js";
