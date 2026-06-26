---
id: packages/github-action-builder/api
title: "@savvy-web/github-action-builder — API reference"
summary: "@savvy-web/github-action-builder API reference: 98 documented symbols."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.4
related: []
---

# @savvy-web/github-action-builder — API reference

## class

- [`ActionYmlMissing`](silk://packages/github-action-builder/api/class/actionymlmissing) — Error when action.yml file is missing.
- [`ActionYmlPathError`](silk://packages/github-action-builder/api/class/actionymlpatherror) — Error when action.yml runs paths don't resolve correctly in destination.
- [`ActionYmlSchemaError`](silk://packages/github-action-builder/api/class/actionymlschemaerror) — Error when action.yml fails schema validation.
- [`ActionYmlSyntaxError`](silk://packages/github-action-builder/api/class/actionymlsyntaxerror) — Error when action.yml has invalid YAML syntax.
- [`BuildFailed`](silk://packages/github-action-builder/api/class/buildfailed) — Error when the build process fails overall.
- [`BundleFailed`](silk://packages/github-action-builder/api/class/bundlefailed) — Error when bundling with rsbuild fails.
- [`CleanError`](silk://packages/github-action-builder/api/class/cleanerror) — Error when cleaning the output directory fails.
- [`ConfigInvalid`](silk://packages/github-action-builder/api/class/configinvalid) — Error when configuration file exists but contains invalid content.
- [`ConfigLoadFailed`](silk://packages/github-action-builder/api/class/configloadfailed) — Error when configuration file fails to load (import error, syntax error, etc.).
- [`ConfigNotFound`](silk://packages/github-action-builder/api/class/confignotfound) — Error when configuration file is not found.
- [`EntryFileMissing`](silk://packages/github-action-builder/api/class/entryfilemissing) — Error when an explicitly specified entry file is missing.
- [`GitHubAction`](silk://packages/github-action-builder/api/class/githubaction) — Main API class for building GitHub Actions.
- [`MainEntryMissing`](silk://packages/github-action-builder/api/class/mainentrymissing) — Error when the required main entry point is missing.
- [`PersistLocalError`](silk://packages/github-action-builder/api/class/persistlocalerror) — Error when persisting build output to local action directory fails.
- [`ValidationFailed`](silk://packages/github-action-builder/api/class/validationfailed) — Error when validation fails in strict mode (CI environment).
- [`WorkerEntryInvalidName`](silk://packages/github-action-builder/api/class/workerentryinvalidname) — Error when a worker entry name is reserved or path-unsafe.
- [`WorkerEntryMissing`](silk://packages/github-action-builder/api/class/workerentrymissing) — Error when a worker entry source file is not found.
- [`WriteError`](silk://packages/github-action-builder/api/class/writeerror) — Error when writing output files fails.

## function

- [`defineConfig`](silk://packages/github-action-builder/api/function/defineconfig) — Define a configuration with full TypeScript support.

## interface

- [`BuildService`](silk://packages/github-action-builder/api/interface/buildservice) — BuildService interface for build and bundling capabilities.
- [`ConfigService`](silk://packages/github-action-builder/api/interface/configservice) — ConfigService interface for configuration management capabilities.
- [`GitHubActionOptions`](silk://packages/github-action-builder/api/interface/githubactionoptions) — Options for creating a GitHubAction builder instance.
- [`LoadConfigResult`](silk://packages/github-action-builder/api/interface/loadconfigresult) — Result of configuration loading.
- [`PersistLocalService`](silk://packages/github-action-builder/api/interface/persistlocalservice) — PersistLocalService interface for copying build output locally.
- [`ValidationService`](silk://packages/github-action-builder/api/interface/validationservice) — ValidationService interface for validation capabilities.

## type

- [`ActionYmlResult`](silk://packages/github-action-builder/api/type/actionymlresult) — Result of action.yml validation.
- [`AppError`](silk://packages/github-action-builder/api/type/apperror) — Union of all possible errors in the GitHub Action Builder.
- [`BuildError`](silk://packages/github-action-builder/api/type/builderror) — Union of all build-related errors.
- [`BuildOptions`](silk://packages/github-action-builder/api/type/buildoptions) — Build options for the bundler.
- [`BuildResult`](silk://packages/github-action-builder/api/type/buildresult) — Result of the complete build process.
- [`BuildRunnerOptions`](silk://packages/github-action-builder/api/type/buildrunneroptions) — Options for the build process.
- [`BundleResult`](silk://packages/github-action-builder/api/type/bundleresult) — Result of bundling a single entry.
- [`BundleStats`](silk://packages/github-action-builder/api/type/bundlestats) — Statistics for a single bundled entry.
- [`Config`](silk://packages/github-action-builder/api/type/config) — Fully resolved configuration with all defaults applied.
- [`ConfigError`](silk://packages/github-action-builder/api/type/configerror) — Union of all configuration-related errors.
- [`ConfigInput`](silk://packages/github-action-builder/api/type/configinput) — User-provided configuration input (all fields optional).
- [`DetectedEntry`](silk://packages/github-action-builder/api/type/detectedentry) — Detected entry point information.
- [`DetectEntriesResult`](silk://packages/github-action-builder/api/type/detectentriesresult) — Result of entry detection.
- [`Entries`](silk://packages/github-action-builder/api/type/entries) — Entry point paths configuration.
- [`GitHubActionBuildResult`](silk://packages/github-action-builder/api/type/githubactionbuildresult) — Result of a GitHubAction build operation.
- [`LoadConfigOptions`](silk://packages/github-action-builder/api/type/loadconfigoptions) — Options for loading configuration.
- [`PersistError`](silk://packages/github-action-builder/api/type/persisterror) — Union of all persist-local-related errors.
- [`PersistLocalOptions`](silk://packages/github-action-builder/api/type/persistlocaloptions) — Persist-local options for copying build output.
- [`PersistLocalResult`](silk://packages/github-action-builder/api/type/persistlocalresult) — Result of the persist-local operation.
- [`PersistLocalRunnerOptions`](silk://packages/github-action-builder/api/type/persistlocalrunneroptions) — Options for the persist operation.
- [`ValidateOptions`](silk://packages/github-action-builder/api/type/validateoptions) — Options for validation.
- [`ValidationError`](silk://packages/github-action-builder/api/type/validationerror) — Union of all validation-related errors.
- [`ValidationErrorItem`](silk://packages/github-action-builder/api/type/validationerroritem) — A validation error item.
- [`ValidationOptions`](silk://packages/github-action-builder/api/type/validationoptions) — Validation options for the build process.
- [`ValidationResult`](silk://packages/github-action-builder/api/type/validationresult) — Validation result with errors and warnings.
- [`ValidationWarning`](silk://packages/github-action-builder/api/type/validationwarning) — A validation warning.

## variable

- [`ActionYmlMissingBase`](silk://packages/github-action-builder/api/variable/actionymlmissingbase) — Base class for ActionYmlMissing error.
- [`ActionYmlPathErrorBase`](silk://packages/github-action-builder/api/variable/actionymlpatherrorbase) — Base class for ActionYmlPathError error.
- [`ActionYmlResultSchema`](silk://packages/github-action-builder/api/variable/actionymlresultschema) — Result of action.yml validation.
- [`ActionYmlSchemaErrorBase`](silk://packages/github-action-builder/api/variable/actionymlschemaerrorbase) — Base class for ActionYmlSchemaError error.
- [`ActionYmlSyntaxErrorBase`](silk://packages/github-action-builder/api/variable/actionymlsyntaxerrorbase) — Base class for ActionYmlSyntaxError error.
- [`AppLayer`](silk://packages/github-action-builder/api/variable/applayer) — Combined layer providing all services.
- [`BuildFailedBase`](silk://packages/github-action-builder/api/variable/buildfailedbase) — Base class for BuildFailed error.
- [`BuildLayer`](silk://packages/github-action-builder/api/variable/buildlayer) — Layer providing BuildService (depends on ConfigService).
- [`BuildOptionsSchema`](silk://packages/github-action-builder/api/variable/buildoptionsschema) — Schema for build options.
- [`BuildResultSchema`](silk://packages/github-action-builder/api/variable/buildresultschema) — Result of the complete build process.
- [`BuildRunnerOptionsSchema`](silk://packages/github-action-builder/api/variable/buildrunneroptionsschema) — Options for the build process.
- [`BuildService`](silk://packages/github-action-builder/api/variable/buildservice) — BuildService tag for dependency injection.
- [`BundleFailedBase`](silk://packages/github-action-builder/api/variable/bundlefailedbase) — Base class for BundleFailed error.
- [`BundleResultSchema`](silk://packages/github-action-builder/api/variable/bundleresultschema) — Result of bundling a single entry.
- [`BundleStatsSchema`](silk://packages/github-action-builder/api/variable/bundlestatsschema) — Statistics for a single bundled entry.
- [`CleanErrorBase`](silk://packages/github-action-builder/api/variable/cleanerrorbase) — Base class for CleanError error.
- [`ConfigInputSchema`](silk://packages/github-action-builder/api/variable/configinputschema) — User-provided configuration input (all fields optional).
- [`ConfigInvalidBase`](silk://packages/github-action-builder/api/variable/configinvalidbase) — Base class for ConfigInvalid error.
- [`ConfigLayer`](silk://packages/github-action-builder/api/variable/configlayer) — Layer providing ConfigService (no dependencies).
- [`ConfigLoadFailedBase`](silk://packages/github-action-builder/api/variable/configloadfailedbase) — Base class for ConfigLoadFailed error.
- [`ConfigNotFoundBase`](silk://packages/github-action-builder/api/variable/confignotfoundbase) — Base class for ConfigNotFound error.
- [`ConfigSchema`](silk://packages/github-action-builder/api/variable/configschema) — Fully resolved configuration with all defaults applied.
- [`ConfigService`](silk://packages/github-action-builder/api/variable/configservice) — ConfigService tag for dependency injection.
- [`DetectedEntrySchema`](silk://packages/github-action-builder/api/variable/detectedentryschema) — Detected entry point information.
- [`DetectEntriesResultSchema`](silk://packages/github-action-builder/api/variable/detectentriesresultschema) — Result of entry detection.
- [`EntriesSchema`](silk://packages/github-action-builder/api/variable/entriesschema) — Schema for entry point paths.
- [`EntryFileMissingBase`](silk://packages/github-action-builder/api/variable/entryfilemissingbase) — Base class for EntryFileMissing error.
- [`GitHubActionBuildResultSchema`](silk://packages/github-action-builder/api/variable/githubactionbuildresultschema) — Result of a GitHubAction build operation.
- [`LoadConfigOptionsSchema`](silk://packages/github-action-builder/api/variable/loadconfigoptionsschema) — Options for loading configuration.
- [`MainEntryMissingBase`](silk://packages/github-action-builder/api/variable/mainentrymissingbase) — Base class for MainEntryMissing error.
- [`PersistLocalErrorBase`](silk://packages/github-action-builder/api/variable/persistlocalerrorbase) — Base class for PersistLocalError error.
- [`PersistLocalLayer`](silk://packages/github-action-builder/api/variable/persistlocallayer) — Layer providing PersistLocalService (no dependencies).
- [`PersistLocalOptionsSchema`](silk://packages/github-action-builder/api/variable/persistlocaloptionsschema) — Schema for persist-local options.
- [`PersistLocalResultSchema`](silk://packages/github-action-builder/api/variable/persistlocalresultschema) — Result of the persist-local operation.
- [`PersistLocalRunnerOptionsSchema`](silk://packages/github-action-builder/api/variable/persistlocalrunneroptionsschema) — Options for the persist operation.
- [`PersistLocalService`](silk://packages/github-action-builder/api/variable/persistlocalservice) — PersistLocalService tag for dependency injection.
- [`ValidateOptionsSchema`](silk://packages/github-action-builder/api/variable/validateoptionsschema) — Options for validation.
- [`ValidationErrorSchema`](silk://packages/github-action-builder/api/variable/validationerrorschema) — A validation error item.
- [`ValidationFailedBase`](silk://packages/github-action-builder/api/variable/validationfailedbase) — Base class for ValidationFailed error.
- [`ValidationLayer`](silk://packages/github-action-builder/api/variable/validationlayer) — Layer providing ValidationService (depends on ConfigService).
- [`ValidationOptionsSchema`](silk://packages/github-action-builder/api/variable/validationoptionsschema) — Schema for validation options.
- [`ValidationResultSchema`](silk://packages/github-action-builder/api/variable/validationresultschema) — Validation result with errors and warnings.
- [`ValidationService`](silk://packages/github-action-builder/api/variable/validationservice) — ValidationService tag for dependency injection.
- [`ValidationWarningSchema`](silk://packages/github-action-builder/api/variable/validationwarningschema) — A validation warning.
- [`WorkerEntryInvalidNameBase`](silk://packages/github-action-builder/api/variable/workerentryinvalidnamebase) — Base class for WorkerEntryInvalidName error.
- [`WorkerEntryMissingBase`](silk://packages/github-action-builder/api/variable/workerentrymissingbase) — Base class for WorkerEntryMissing error.
- [`WriteErrorBase`](silk://packages/github-action-builder/api/variable/writeerrorbase) — Base class for WriteError error.
