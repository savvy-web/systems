---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### API Extractor meta generation in `@savvy-web/tsdown-plugins`

Adds a meta-generation pipeline that produces an api-model from tsdown-emitted `.d.ts` declarations. The api-model bundle comprises a `.api.json` model, a `tsdoc-metadata.json`, and a deterministic, idempotent `tsdoc.json`. Single-entry packages run extraction directly; multi-entry packages extract per entry and merge the api-models, rewriting canonical references. Doc-warning suppression is configurable by `messageId`, text pattern, or both, and custom TSDoc tags can be declared.

New exports:

* `generateMeta` and `normalizeMetaOptions`
* Types `MetaOptions`, `NormalizedMeta`, `TsdocOptions`, `TsdocTagDefinition`, `WarningSuppressionRule`, `GenerateMetaOptions`, and `MetaResult`

### `meta` build target in `@savvy-web/bundler`

* New `meta?: MetaOptions` field on `defineBuild`
* New `savvy build --target meta` — generates the api-model from the dev build's `.d.ts` and writes it into each configured `localPaths` directory. The target depends only on `build:dev` and runs no tsdown build of its own.
* `savvy build --target prod` now also emits a `meta/` release-asset bundle into `dist/prod/npm/meta` when `meta` is configured.

## Dependencies

| Dependency                | Type           | Action | From | To       |
| :------------------------ | :------------- | :----- | :--- | :------- |
| @microsoft/api-extractor  | dependency     | added  | —    | ^7.58.7  |
| @microsoft/tsdoc          | dependency     | added  | —    | ^0.16.0  |
| @microsoft/tsdoc-config   | dependency     | added  | —    | ^0.18.1  |
| deep-equal                | dependency     | added  | —    | ^2.2.3   |
| @types/deep-equal         | devDependency  | added  | —    | ^1.0.4   |
