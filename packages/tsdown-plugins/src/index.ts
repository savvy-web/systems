export {
	CatalogAssemblyError,
	DependencyResolutionError,
	ManifestDecodeError,
	UnresolvedDependencyError,
} from "@effected/npm";
export type { BuildTargetGroupsOptions, CssOptions, EntryOverride, TsdownBuild } from "./build/build-target-groups.js";
export { buildTargetGroups } from "./build/build-target-groups.js";
export { cjsDefaultInterop } from "./build/cjs-default-interop.js";
export type { LooseFileSpec, LooseFiles, NormalizedLooseFile } from "./build/loose-files.js";
export { normalizeLooseFiles } from "./build/loose-files.js";
export { nodeBuiltinDefaultInterop } from "./build/node-builtin-default-interop.js";
export { removeDeclarationMaps } from "./build/strip-maps.js";
export type { CopyAmbientDtsOptions } from "./build/sync-public.js";
export { copyAmbientDts, copyPublicDir } from "./build/sync-public.js";
export type {
	BuildFormat,
	BuildGroupSpec,
	BuildPlatform,
	DeriveOptions,
	DerivedTsdownOptions,
	TargetGroupId,
} from "./build/target-groups.js";
export { deriveTargetGroupOptions } from "./build/target-groups.js";
export type { ManifestLike } from "./catalog/resolve-catalogs.js";
export { resolveManifest } from "./catalog/resolve-catalogs.js";
export type { NextVersions } from "./changesets/next-versions.js";
export { resolveNextVersions } from "./changesets/next-versions.js";
export type { ValidationInput } from "./config-validation/ConfigValidator.js";
export { ConfigValidator } from "./config-validation/ConfigValidator.js";
export type { ModuleExportNames, ReexportBarrelAnalysis } from "./dts/reexport-stub.js";
export { analyzeReexportBarrel, collectExportNames, renderReexportStub } from "./dts/reexport-stub.js";
export { findRelativeSpecifiers } from "./dts/relative-imports.js";
export type { ResolvedTsconfig, ResolvedTsconfigOptions } from "./dts/resolved-tsconfig.js";
export { buildResolvedTsconfig, writeDtsEmitTsconfig, writeResolvedTsconfig } from "./dts/resolved-tsconfig.js";
export type { AmbientDtsEntry, DtsExportClass, ExtractAmbientOptions } from "./entry/ambient-dts.js";
export {
	ambientOutName,
	assertNoEntryCollisions,
	classifyDtsExport,
	declarationExt,
	extractAmbientDts,
	mixedDtsExportError,
} from "./entry/ambient-dts.js";
export type { ExtractOptions, ExtractResult, PackageJsonLike } from "./entry/extract.js";
export { createEntryName, extractEntries } from "./entry/extract.js";
export type { PackageJsonEntriesOptions } from "./entry/package-json-entries.js";
export { packageJsonEntries } from "./entry/package-json-entries.js";
export { ConfigValidationError, MetaGenerationError } from "./errors.js";
export type { ExeBuild, RunExeBuildOptions } from "./exe/build.js";
export { runExeBuild } from "./exe/build.js";
export type { ExeConfig, ExeSeaConfig, ExeTarget, ExeTargetInput, NormalizedExe, PkgOsCpu } from "./exe/config.js";
export { DEFAULT_EXE_NODE_VERSION, normalizeExeOptions } from "./exe/config.js";
export { computeExeFileName } from "./exe/filename.js";
export type { JsxConfig, TsconfigJsx } from "./jsx/config.js";
export { readTsconfigJsx, resolveJsxConfig } from "./jsx/config.js";
export type { BuildEmittedManifestOptions, EmitManifestOptions, TargetGroupRef } from "./manifest/emit-manifest.js";
export { buildEmittedManifest, emitManifest } from "./manifest/emit-manifest.js";
export type { DualExports, ExeRewrite, Json, TransformManifestOptions } from "./manifest/transform.js";
export {
	defaultManifestTransform,
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
export type { WriteGeneratedOgImageOptions } from "./meta/og-image.js";
export { OgGenerateError, writeGeneratedOgImage } from "./meta/og-image.js";
export { rewriteMetaVersions } from "./meta/optimistic.js";
export type { RunMetaPassOptions } from "./meta/run-pass.js";
export { applySubdirMetaEntries, deriveExportPaths, runMetaPass } from "./meta/run-pass.js";
export type { PortableTsconfig, ResolvedCompilerOptions } from "./meta/tsconfig-resolver.js";
export { resolvePortableTsconfig } from "./meta/tsconfig-resolver.js";
export type { OgImageInfo, TsdoctorMetaOptions } from "./meta/tsdoctor-config.js";
export type { ComposeManifestInput, ManifestRepository, ManifestTarget } from "./meta/tsdoctor-manifest.js";
export {
	composeTsdoctorManifest,
	githubOwnerRepo,
	ogImageInfoOf,
	registriesFromTargets,
} from "./meta/tsdoctor-manifest.js";
export type { TsdoctorSources } from "./meta/tsdoctor-source.js";
export { TsdoctorSourceError, loadTsdoctorSources } from "./meta/tsdoctor-source.js";
export type { DiagnosticInput, PassKind } from "./report/collector.js";
export { BuildCollector, BuildCollectorTag } from "./report/collector.js";
export type { Formatter, FormatterContext, RenderedOutput } from "./report/formatters/index.js";
export {
	CiAnnotationsFormatter,
	JsonFormatter,
	MarkdownFormatter,
	SilentFormatter,
	TerminalFormatter,
} from "./report/formatters/index.js";
export type { BuildIssues, PlainDiagnostic } from "./report/issues-artifact.js";
// report surface
export { flattenIssues, serializeIssues, writeIssuesArtifact } from "./report/issues-artifact.js";
export { buildMetricsPlugin } from "./report/metrics-plugin.js";
export type { RenderReportOptions } from "./report/pipeline.js";
export { ReportPipeline, renderReport } from "./report/pipeline.js";
export type { BuildReport, DiagnosticEntry, EmittedFile, PassReport, TargetGroupReport } from "./report/schema.js";
export {
	BuildReport as BuildReportSchema,
	ReportTimings,
	TargetGroupReport as TargetGroupReportSchema,
} from "./report/schema.js";
export type { Environment } from "./report/services/EnvironmentDetector.js";
export { EnvironmentDetector } from "./report/services/EnvironmentDetector.js";
export type { Executor } from "./report/services/ExecutorResolver.js";
export { ExecutorResolver } from "./report/services/ExecutorResolver.js";
export type { OutputFormat } from "./report/services/FormatSelector.js";
export { FormatSelector } from "./report/services/FormatSelector.js";
export { OutputRenderer } from "./report/services/OutputRenderer.js";
export type { Timer } from "./report/timer.js";
export { createTimer, formatTime } from "./report/timer.js";
export type { TsdownLogger } from "./report/tsdown-logger.js";
export { createTsdownLogger } from "./report/tsdown-logger.js";
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
