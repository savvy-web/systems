# @savvy-web/tsdown-plugins

`@savvy-web/tsdown-plugins` is the interface-only tsdown/rolldown plugin pack holding every build behavior that `@savvy-web/bundler` orchestrates. Authored against rolldown's `Plugin` type only — no tsdown runtime, no tsdown peer.

## Key surface

- Entry detection; manifest transforms (`emitManifest`, `defaultManifestTransform`, the `"./package.json"` self-export inject); `resolveManifest` over `workspaces-effect`'s `CatalogResolver`.
- `buildTargetGroups`: name-aware two-pass per-TargetGroup loop (per-module JS pass + bundled `emitDtsOnly` dts pass — `bin/` executable entries are dropped from the dts pass, so bin-only partitions skip it), configurable `BuildFormat`, per-entry `overrides` (`EntryOverride`/`DualExports`), and `bundle`/`bundleNodeModules`/`dtsExternals` bundling posture.
- `src/meta/`: `runMetaPass` (`run-pass.ts`) — the single meta-generation orchestrator called by the front-door `runBuild` AND by both self-hosting escape hatches — wrapping `generateMeta` over `@microsoft/api-extractor` + multi-entry api-model merge, the portable-tsconfig resolver (`typescript` is a runtime dep), `syncPublicDir`; `deriveExportPaths`/`applySubdirMetaEntries` (moved here from the bundler) are exported alongside it.
- `src/targets/`: `resolveTargets`/`writeTargetsBinding` deriving byte-variant groups from `publishConfig.targets`; throws `ConfigValidationError`.
- `src/jsx/` (tsconfig→rolldown JSX), `src/exe/` (`normalizeExeOptions`/`runExeBuild`).
- `src/report/`: `BuildCollector`/`BuildCollectorTag`, `createTsdownLogger`, `buildMetricsPlugin`, and the `BuildReport` schema (`passes: PassReport[]` with `EmittedFile` + `DiagnosticEntry[]`) that the bundler renders into one unified log. API Extractor analyzer messages (`ae-forgotten-export`, `ae-missing-release-tag`, `tsdoc-*`) surface as warnings; forgotten exports escalate to a hard build error under CI. `src/report/issues-artifact.ts` is the persisted counterpart — `flattenIssues`/`writeIssuesArtifact` (re-exported) write a deduped `dist/<target>/issues.json` on every build (always written: absent means not-built, empty means clean; `ae-*`/`tsdoc-*` are prod-only), the structured surface the tsdoctor agent and tsdoc skill consume.
- Rolldown transforms: `nodeBuiltinDefaultInterop` (cjs default-import interop), `removeDeclarationMaps`, `cjsDefaultInterop`.
- `ConfigValidator`/`ConfigValidatorLive` rule set; ships a synced local `ecma.json` copy guarded by a unit test.
- Self-hosts (bootstraps via `tsx`, its `savvy.build.ts` calling `runMetaPass` directly); versions independently from the bundler. On prod its self-build emits its own api-model, `dist/prod/issues.json`, and is API-Extractor validated, so tsdown-plugins now publishes into the mcp + website corpus.

## Design

Load for the interface-only boundary, the helper/service map, and the build-loop internals:
→ `@../../.claude/design/tsdown-plugins/architecture.md`
Load when changing a build behavior, the manifest/meta/targets pipelines, or the report subsystem.
