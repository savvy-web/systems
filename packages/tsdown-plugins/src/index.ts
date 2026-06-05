export type { ManifestLike } from "workspaces-effect";
export { CatalogAssemblyError, CatalogResolutionError } from "workspaces-effect";
export type { BuildTargetGroupsOptions, TsdownBuild } from "./build/build-target-groups.js";
export { buildTargetGroups } from "./build/build-target-groups.js";
export type { BuildGroupSpec, DeriveOptions, DerivedTsdownOptions, TargetGroupId } from "./build/target-groups.js";
export { deriveTargetGroupOptions } from "./build/target-groups.js";
export { resolveManifest } from "./catalog/resolve-catalogs.js";
export type { ResolvedTsconfig, ResolvedTsconfigOptions } from "./dts/resolved-tsconfig.js";
export { buildResolvedTsconfig, writeResolvedTsconfig } from "./dts/resolved-tsconfig.js";
export type { ExtractOptions, ExtractResult, PackageJsonLike } from "./entry/extract.js";
export { extractEntries } from "./entry/extract.js";
export type { PackageJsonEntriesOptions } from "./entry/package-json-entries.js";
export { packageJsonEntries } from "./entry/package-json-entries.js";
export { MetaGenerationError } from "./errors.js";
export type { BuildEmittedManifestOptions, EmitManifestOptions, TargetGroupRef } from "./manifest/emit-manifest.js";
export { buildEmittedManifest, emitManifest } from "./manifest/emit-manifest.js";
export type { Json, TransformManifestOptions } from "./manifest/transform.js";
export {
	normalizeBinPaths,
	transformBin,
	transformExports,
	transformManifest,
} from "./manifest/transform.js";
export type {
	MetaOptions,
	NormalizedMeta,
	TsdocOptions,
	TsdocTagDefinition,
	WarningSuppressionRule,
} from "./meta/config.js";
export { normalizeMetaOptions } from "./meta/config.js";
export type { GenerateMetaOptions, MetaResult } from "./meta/generate.js";
export { generateMeta } from "./meta/generate.js";
export type { Formatter, FormatterContext, RenderedOutput } from "./report/formatters/index.js";
export {
	CiAnnotationsFormatter,
	JsonFormatter,
	MarkdownFormatter,
	SilentFormatter,
	TerminalFormatter,
} from "./report/formatters/index.js";
export { EnvironmentDetectorLive } from "./report/layers/EnvironmentDetectorLive.js";
export { ExecutorResolverLive } from "./report/layers/ExecutorResolverLive.js";
export { FormatSelectorLive } from "./report/layers/FormatSelectorLive.js";
export { OutputRendererLive } from "./report/layers/OutputRendererLive.js";
export type { RenderReportOptions } from "./report/pipeline.js";
export { ReportPipelineLive, renderReport } from "./report/pipeline.js";
// report surface
export type { BuildReport, TargetGroupReport } from "./report/schema.js";
export {
	BuildReport as BuildReportSchema,
	ReportTimings,
	TargetGroupReport as TargetGroupReportSchema,
} from "./report/schema.js";
export { generateBuildReportSchema } from "./report/schema-export.js";
export type { Environment } from "./report/services/EnvironmentDetector.js";
export { EnvironmentDetector } from "./report/services/EnvironmentDetector.js";
export type { Executor } from "./report/services/ExecutorResolver.js";
export { ExecutorResolver } from "./report/services/ExecutorResolver.js";
export type { OutputFormat } from "./report/services/FormatSelector.js";
export { FormatSelector } from "./report/services/FormatSelector.js";
export { OutputRenderer } from "./report/services/OutputRenderer.js";
export type { Timer } from "./report/timer.js";
export { createTimer, formatTime } from "./report/timer.js";
export { writeTargetsBinding } from "./targets/binding.js";
export type {
	PublishTargetObject,
	PublishTargetValue,
	PublishTargets,
	ResolvedGroup,
	ResolvedTarget,
	TargetResolution,
} from "./targets/config.js";
export { isTargetObject } from "./targets/config.js";
export { resolveTargets } from "./targets/resolve-targets.js";
