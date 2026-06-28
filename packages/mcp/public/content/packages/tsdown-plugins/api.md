---
id: packages/tsdown-plugins/api
title: "@savvy-web/tsdown-plugins — API reference"
summary: "@savvy-web/tsdown-plugins API reference: 156 documented symbols."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.4
related: []
---

# @savvy-web/tsdown-plugins — API reference

## class

- [`BuildCollector`](silk://packages/tsdown-plugins/api/class/buildcollector) — Stateful build-event accumulator. The write surface is synchronous so it can be called directly from tsdown's customLogger and API Extractor's messageCallback (both invoked synchronously). `snapshot` builds the immutable BuildReport the Effect render pipeline consumes.
- [`BuildCollectorTag`](silk://packages/tsdown-plugins/api/class/buildcollectortag)
- [`BuildReport`](silk://packages/tsdown-plugins/api/class/buildreport)
- [`ConfigValidationError`](silk://packages/tsdown-plugins/api/class/configvalidationerror) — A savvy.build.ts or publishConfig.targets config is structurally invalid; raised before any build work.
- [`ConfigValidator`](silk://packages/tsdown-plugins/api/class/configvalidator) — Fast-fail config validator; runs first in the bundler over the resolved config.
- [`DiagnosticEntry`](silk://packages/tsdown-plugins/api/class/diagnosticentry) — A captured warning or error, from tsdown's logger, rolldown's onLog, or API Extractor.
- [`EmittedFile`](silk://packages/tsdown-plugins/api/class/emittedfile) — One emitted output file with its in-memory byte size (gzip only when --verbose).
- [`EnvironmentDetector`](silk://packages/tsdown-plugins/api/class/environmentdetector)
- [`ExecutorResolver`](silk://packages/tsdown-plugins/api/class/executorresolver)
- [`FormatSelector`](silk://packages/tsdown-plugins/api/class/formatselector)
- [`MetaGenerationError`](silk://packages/tsdown-plugins/api/class/metagenerationerror) — API Extractor meta generation failed for an entry.
- [`OutputRenderer`](silk://packages/tsdown-plugins/api/class/outputrenderer)
- [`PassReport`](silk://packages/tsdown-plugins/api/class/passreport) — One build pass within a target group (js / dts / loose / exe / meta).
- [`ReportTimings`](silk://packages/tsdown-plugins/api/class/reporttimings)
- [`TargetGroupReport`](silk://packages/tsdown-plugins/api/class/targetgroupreport)
- [`TsconfigResolver`](silk://packages/tsdown-plugins/api/class/tsconfigresolver) — Resolves a TypeScript `ParsedCommandLine` to a portable, JSON-serializable tsconfig (compilerOptions-only) for virtual TypeScript environments.

## function

- [`ambientOutName`](silk://packages/tsdown-plugins/api/function/ambientoutname) — Output basename (including the preserved declaration extension) for an ambient export, derived from the export KEY — consistent with how JS entries are named.
- [`analyzeReexportBarrel`](silk://packages/tsdown-plugins/api/function/analyzereexportbarrel) — Analyze an entry source as a candidate pure re-export barrel: classify its re-exported names into value vs type-only and report whether it is expressible as a thin stub. Pure parsing — no I/O.
- [`applySubdirMetaEntries`](silk://packages/tsdown-plugins/api/function/applysubdirmetaentries) — For each `outSubdir` override, point its meta entry at the isolated sub-package barrel.
- [`assertNoEntryCollisions`](silk://packages/tsdown-plugins/api/function/assertnoentrycollisions) — Throw ConfigValidationError if any ambient output name collides with a JS build-entry name. The JS entry names carry no extension, so each ambient `outName` is compared with its declaration extension stripped.
- [`buildEmittedManifest`](silk://packages/tsdown-plugins/api/function/buildemittedmanifest) — Compute the final manifest bytes for a TargetGroup (catalog resolution + standard transforms).
- [`buildMetricsPlugin`](silk://packages/tsdown-plugins/api/function/buildmetricsplugin) — Rolldown plugin that records emitted-file metrics into the BuildCollector via writeBundle (which fires for the JS pass AND the emitDtsOnly dts pass — verified against tsdown 0.22.3), plus a defensive onLog for rolldown-level diagnostics that bypass tsdown's logger. Append it to each build pass's `plugins` array. `bytes` is taken from the in-memory chunk/asset content (no fs); `gzip` is computed only when `verbose`.
- [`buildResolvedTsconfig`](silk://packages/tsdown-plugins/api/function/buildresolvedtsconfig) — Build the portable absolute-path tsconfig object (ported from rslib writeBundleTempConfig).
- [`buildTargetGroups`](silk://packages/tsdown-plugins/api/function/buildtargetgroups) — Run tsdown.build() per TargetGroup. Composable so the escape hatch gets multi-group too. Each group runs TWO passes to the SAME outDir: 1. JS pass — per-module JS (`unbundle: true`, `dts: false`), with the `emitManifest` plugin and the `public/` copy. Default `clean: true` gives it a fresh outDir. 2. dts pass — bundled declarations only (`unbundle: false`, `dts: { emitDtsOnly: true }`, `clean: false`). No manifest plugin, no copy, no sourcemaps. `clean: false` is load-bearing: it must NOT wipe the JS the first pass just wrote. Why two passes: tsdown's `unbundle` maps to rolldown `output.preserveModules` for the whole build (JS and the dts plugin share it), so a single pass cannot give per-module JS + bundled dts. Per-module dts breaks type portability (TS2883); bundling the JS re-bundles workspace consumers. The split keeps per-module JS AND rolled-up, self-contained declarations.
- [`cjsDefaultInterop`](silk://packages/tsdown-plugins/api/function/cjsdefaultinterop) — Rolldown plugin: append the CJS default-interop footer to ENTRY chunks of the `cjs` format that export a default alongside named exports. Gated tightly so it never touches the wrong chunk: - format must be `cjs` (ESM is untouched; `import().default` on ESM is already correct); - the chunk must be an ENTRY chunk — never a SHARED chunk. Shared chunks are required by entry chunks via their named bindings (e.g. `require_changesets.changesets_exports.X`); reassigning a shared chunk's `module.exports` to its own default would break those reads (many bundled vendor chunks carry an `exports.default`); - the chunk must export a `default` AND at least one named export. A default-only chunk already gets `module.exports = <default>` from rolldown, and a named-only chunk has no default to promote. The emitted footer is also self-guarded (`module.exports.default !== void 0`), so it is a runtime no-op whenever the static gate is ever too generous.
- [`classifyDtsExport`](silk://packages/tsdown-plugins/api/function/classifydtsexport) — Classify an export value: - `ambient` — a types-only declaration source (bare `.d.ts` string, or `{ types: "*.d.ts" }` with no runtime source). - `mixed` — a declaration `types` AND a compilable runtime source (`import`/`require`/`default` → `.ts`/`.tsx`). - `none` — anything else (normal runtime export, json, etc.).
- [`collectExportNames`](silk://packages/tsdown-plugins/api/function/collectexportnames) — Collect every name a module exports (named re-exports, namespace re-exports, and local `export` declarations). Used to test whether a barrel's re-exports are a strict subset of a base entry, so a stub re-exporting from that base resolves every symbol. Pure parsing — no I/O.
- [`computeExeFileName`](silk://packages/tsdown-plugins/api/function/computeexefilename) — The exact filename `@tsdown/exe` emits for a SEA target, mirroring tsdown's `resolveOutputFileName`: base fileName + `-<platform>-<arch>` + `.exe` on win. Single source of truth so the manifest value never drifts from the on-disk file.
- [`copyAmbientDts`](silk://packages/tsdown-plugins/api/function/copyambientdts) — Copy each ambient `.d.ts` export's source verbatim into `outDir/<outName>`, byte-stable (an unchanged file keeps its timestamp). The copy is NOT compiled or bundled, so the build owns two fast-fail checks: the source must exist, and it must be self-contained — a relative import/export/reference would not resolve once the file is flattened to the package root. Throws ConfigValidationError on a missing source or any relative specifier.
- [`createTimer`](silk://packages/tsdown-plugins/api/function/createtimer) — Create a wall-clock timer. (Date.now is fine in runtime build code.)
- [`createTsdownLogger`](silk://packages/tsdown-plugins/api/function/createtsdownlogger) — A tsdown `customLogger` that routes warnings/errors into the BuildCollector instead of the console. Paired with `logLevel: "silent"` in the same build config: silent suppresses tsdown's own console output while this logger still receives every message (verified against tsdown 0.22.3). info/success are dropped — file metrics come from the writeBundle plugin and timing from our timer.
- [`declarationExt`](silk://packages/tsdown-plugins/api/function/declarationext) — The declaration-file extension of a path, or undefined when it is not a declaration file.
- [`defaultManifestTransform`](silk://packages/tsdown-plugins/api/function/defaultmanifesttransform) — The default `transform` applied to every package's manifest when its `savvy.build.ts` does not provide one of its own. Strips the build/dev-only fields in `NON_PUBLISHED_FIELDS` from the emitted package.json. This is the pattern nearly every package repeated by hand (inherited from rslib-builder); `defineBuild` now applies it automatically so a package needs a `transform` only when it has genuinely custom manifest work to do (e.g. silk promoting workspace deps to peerDependencies). A custom transform REPLACES this default — re-export it and call it from a custom transform to keep the stripping. `targetGroup` is accepted (so this is assignable wherever the full transform signature is expected) but unused; the strip is identical for every group. Pure: the supplied `pkg` is NOT mutated — a shallow copy with the fields removed is returned, so external callers invoking this from a custom transform keep their input intact.
- [`deriveExportPaths`](silk://packages/tsdown-plugins/api/function/deriveexportpaths) — Map entry names to export paths using the package exports map. index maps to ".".
- [`deriveTargetGroupOptions`](silk://packages/tsdown-plugins/api/function/derivetargetgroupoptions) — Derive the JS-pass tsdown options for one TargetGroup (per-module JS, no dts).
- [`emitManifest`](silk://packages/tsdown-plugins/api/function/emitmanifest) — Rolldown plugin: emit the transformed package.json + LICENSE/README into the output pkg/ root.
- [`extractAmbientDts`](silk://packages/tsdown-plugins/api/function/extractambientdts) — Extract the types-only `.d.ts` exports from a package's `exports` map. Pure. Throws ConfigValidationError on a mixed export (Decision 2) or an ambient-vs-ambient output-name collision.
- [`extractEntries`](silk://packages/tsdown-plugins/api/function/extractentries)
- [`findRelativeSpecifiers`](silk://packages/tsdown-plugins/api/function/findrelativespecifiers)
- [`flattenIssues`](silk://packages/tsdown-plugins/api/function/flattenissues) — Flatten a build snapshot into the aggregated, de-duplicated issues artifact. Pure.
- [`formatTime`](silk://packages/tsdown-plugins/api/function/formattime)
- [`generateMeta`](silk://packages/tsdown-plugins/api/function/generatemeta) — Generate the api-model meta bundle from already-emitted .d.ts. Writes tsdoc.json (idempotent), runs the extractor per entry, merges if needed, and writes the "virtual TS env" trio to outMetaDir (`<unscoped>.api.json` + the final `package.json` + a portable `tsconfig.json`), copying that trio into each localPaths dir. The api-extractor `tsdoc-metadata.json` is a published-package artifact and is written into `dtsDir` (the built pkg/), not the meta bundle.
- [`isTargetObject`](silk://packages/tsdown-plugins/api/function/istargetobject) — True when a target value is the object form (carries registry/name/from).
- [`mixedDtsExportError`](silk://packages/tsdown-plugins/api/function/mixeddtsexporterror) — The shared mixed-export error (Decision 2), used by both the extractor and the manifest transform.
- [`nodeBuiltinDefaultInterop`](silk://packages/tsdown-plugins/api/function/nodebuiltindefaultinterop) — Rewrite a default import / default re-export of a Node built-in into the equivalent NAMESPACE form, so rolldown's CJS codegen produces correct interop. Why this exists — a rolldown 1.1.0 codegen defect (verified against the latest published rolldown 1.1.0 / tsdown 0.22.2, with no newer release to upgrade to): For a default import of an EXTERNAL Node builtin, rolldown emits a bare `require("node:x")` WITHOUT its `__toESM` interop wrapper, yet still accesses `.default` — which is `undefined` on a builtin's CJS export object, so the call throws `Cannot read properties of undefined (reading 'cwd')` at runtime. NAMED imports are unaffected (`(0, node_process.cwd)()` reads a real property), and a NAMESPACE import is handled correctly: rolldown wraps it as `node_process = __toESM(require("node:process"), 1)`, which synthesizes `.default` and copies every own property, so member access works. This transform converts the broken default form into the working namespace form BEFORE codegen, so it is immune to minification and applies identically to per-module and bundled output. rolldown exposes no Rollup-style `output.interop` knob to fix this at the output layer, which is why the correction happens here on the source. Rewrites (the two static forms that occur in practice, anchored to statement start): The namespace binding NAME carries the builtin's named exports (`NAME.cwd`, `NAME.join`, ...), which is exactly how a default import of a builtin is consumed in practice. ESM output is unaffected at runtime (a namespace import of a builtin resolves to the same members), so the plugin is safe to attach to dual builds.
- [`normalizeBinPaths`](silk://packages/tsdown-plugins/api/function/normalizebinpaths) — FINAL guard: strip leading ./ from bin paths (npm 11.x drops ./-prefixed bins).
- [`normalizeExeOptions`](silk://packages/tsdown-plugins/api/function/normalizeexeoptions) — Normalize `exe` (object or array) into one fully-resolved spec per binary. Pure function; structural validation (missing fileName, empty targets) lives in the config-validation layer.
- [`normalizeLooseFiles`](silk://packages/tsdown-plugins/api/function/normalizeloosefiles) — Resolve a `looseFiles` map into normalized build descriptors. Pure (no filesystem): a missing `source` is surfaced later by tsdown's entry resolution. Throws ConfigValidationError on any structural problem so the bundler's ConfigValidator surfaces it as a typed, fast-fail config error.
- [`normalizeMetaOptions`](silk://packages/tsdown-plugins/api/function/normalizemetaoptions) — Fill defaults so downstream code never branches on undefined.
- [`packageJsonEntries`](silk://packages/tsdown-plugins/api/function/packagejsonentries) — Derive a tsdown `entry` record (name to source path) from a package.json.
- [`readTsconfigJsx`](silk://packages/tsdown-plugins/api/function/readtsconfigjsx) — Read the jsx-relevant compilerOptions from a package's own tsconfig.json (best-effort; returns empty on absence or parse error).
- [`removeDeclarationMaps`](silk://packages/tsdown-plugins/api/function/removedeclarationmaps) — Remove declaration source-map files (`.d.ts.map` / `.d.cts.map`) from a built `pkg` directory, returning the removed paths. The dts pass emits these next to each `.d.ts` (the resolved dts tsconfig sets `declarationMap: true`) because API Extractor reads them during meta generation to resolve original-source positions. But they are dead weight in a PUBLISHED package — they reference `.ts` sources the tarball does not ship — and they leak local source paths, so the prod build strips them AFTER meta generation has consumed them. The dev build keeps them (it is never published, and `savvy build --target meta` reads them). Recurses, but skips `node_modules` so it does not traverse a self-contained bundle's vendored tree — only the package's own emitted declarations carry maps worth stripping.
- [`renderReexportStub`](silk://packages/tsdown-plugins/api/function/renderreexportstub) — Render a thin re-export-stub `.d.ts`/`.d.cts` body: named re-exports of `valueNames` and `typeNames` from `baseSpecifier` (the published file of the base entry, e.g. `./index.js` for the ESM `.d.ts` or `./index.cjs` for the CJS `.d.cts`). Names are sorted so the output is deterministic. Returns the empty string when there is nothing to re-export.
- [`renderReport`](silk://packages/tsdown-plugins/api/function/renderreport)
- [`resolveJsxConfig`](silk://packages/tsdown-plugins/api/function/resolvejsxconfig) — Resolve the effective JSX config: an explicit override wins; otherwise infer from the tsconfig values. Returns undefined when no JSX transform is needed (preserve/none).
- [`resolveManifest`](silk://packages/tsdown-plugins/api/function/resolvemanifest) — Resolve every `catalog:`/`workspace:` specifier in a manifest to a concrete spec, delegating to workspaces-effect's CatalogResolver. The resolver discovers the workspace root from `process.cwd()` (run this from inside the target workspace) and assembles catalogs durably (inline + config-dependency hook-replay + lockfile), so no transient `.pnpm-workspace-state-v1.json` is required. Rejects with `CatalogResolutionError` on an unresolvable reference, or `CatalogAssemblyError` if the workspace catalog set cannot be assembled.
- [`resolveNextVersions`](silk://packages/tsdown-plugins/api/function/resolvenextversions) — Resolve the next release version of every workspace package from pending changesets. Walks up from `cwd` to the monorepo root via `@manypkg/get-packages`, seeds the map with each package's CURRENT version, then overlays `newVersion` for changeset-affected packages via `@changesets/get-release-plan`. Never rejects: any failure (not a workspace, missing `.changeset/config.json`, parse error) degrades to current versions (or an empty map).
- [`resolvePortableTsconfig`](silk://packages/tsdown-plugins/api/function/resolveportabletsconfig) — Resolves the package's effective compiler options (following `extends`) into a portable, JSON-serializable tsconfig for the meta release bundle.
- [`resolveTargets`](silk://packages/tsdown-plugins/api/function/resolvetargets) — Resolve a `publishConfig.targets` map into the distinct groups to build and every target bound to one. Pure; throws ConfigValidationError on structurally-invalid config.
- [`rewriteMetaVersions`](silk://packages/tsdown-plugins/api/function/rewritemetaversions) — Rewrite a meta `package.json` so the package's own `version` and any workspace-sibling dependency version reflect their NEXT release version from `versions`. Pure: returns a new object, never mutates the input. External/catalog-resolved deps (names absent from `versions`) are left as-is.
- [`runExeBuild`](silk://packages/tsdown-plugins/api/function/runexebuild) — Compile each SEA binary via tsdown's exe mode. One tsdown build per spec.
- [`runMetaPass`](silk://packages/tsdown-plugins/api/function/runmetapass) — Meta-pass orchestrator: derives export paths, filters bin/ entries, resolves optimistic next-versions, and calls generateMeta once per publish group.
- [`serializeIssues`](silk://packages/tsdown-plugins/api/function/serializeissues) — Serialize the issues artifact to pretty JSON with a trailing newline.
- [`syncPublicDir`](silk://packages/tsdown-plugins/api/function/syncpublicdir) — Mirror `sourceDir` into `targetDir`, idempotently. Replaces tsdown's built-in `copy`, whose non-recursive mkdir throws `EEXIST` when the target already exists (re-builds, `prepare`-on-install, concurrent turbo invocations). Behavior: - source absent: no-op. - target absent: copy `sourceDir` wholesale. - target present: copy only files that are new or whose bytes differ, then delete target files that no longer exist in the source and prune the directories left empty. The byte-diff keeps unchanged files (and their timestamps) untouched, so a large copied asset tree — e.g. the mcp markdown corpus — is not rewritten on every build.
- [`transformBin`](silk://packages/tsdown-plugins/api/function/transformbin) — Rewrite bin: TS targets to bin/[command].js (string to bin/cli.js); strip leading ./ otherwise.
- [`transformExports`](silk://packages/tsdown-plugins/api/function/transformexports) — Rewrite an exports map: TS string targets become a types/import conditions object. Each TS condition also gets a `require` entry when `dual` is `true` (uniform) or when the export key is in the `dual` Set (per-entry). The output path is derived from the export KEY via the shared entry-name function, never from the source path, so the manifest target always matches the emitted file. Export keys in `subdirExports` are built into an isolated `<key>/index.*` subdir (e.g. an RSPress `./runtime`), so their conditions gain an `/index` segment.
- [`transformManifest`](silk://packages/tsdown-plugins/api/function/transformmanifest) — Apply the full standard manifest transform (excluding catalog resolution, done upstream).
- [`writeDtsEmitTsconfig`](silk://packages/tsdown-plugins/api/function/writedtsemittsconfig) — Derive a dts-EMIT variant of an already-written resolved tsconfig that adds `stableTypeOrdering: true`, and return its path. This makes the TypeScript declaration emitter (rolldown-plugin-dts on `typescript@6`) order union/type members deterministically, so a multi-union `.d.ts` (e.g. an Effect `Layer.Layer<…>` requirement channel) does not flip member order across otherwise-identical builds (#156). It is kept in a SEPARATE file from the api-extractor tsconfig on purpose: `@microsoft/api-extractor` pins `typescript ~5.9`, which predates the flag and hard-errors on the unknown compiler option — so only the emit passes (which run on TS6) ever see it, while the api-extractor compile reads the original clean config. Best-effort: if the base tsconfig cannot be read or parsed (e.g. a synthetic test path that was never written), the original path is returned unchanged — the emit then simply keeps TS's default ordering rather than aborting the build at this layer.
- [`writeIssuesArtifact`](silk://packages/tsdown-plugins/api/function/writeissuesartifact) — Write the aggregated issues artifact to `<cwd>/dist/<target>/issues.json`. Returns the path written.
- [`writeResolvedTsconfig`](silk://packages/tsdown-plugins/api/function/writeresolvedtsconfig) — Write the resolved tsconfig to a temp file and return its absolute path.
- [`writeTargetsBinding`](silk://packages/tsdown-plugins/api/function/writetargetsbinding) — Write the target-to-group binding to dist/prod/targets.json for the release action to consume. Returns the path.

## interface

- [`AmbientDtsEntry`](silk://packages/tsdown-plugins/api/interface/ambientdtsentry) — One ambient `.d.ts` export resolved for copy + manifest.
- [`BuildEmittedManifestOptions`](silk://packages/tsdown-plugins/api/interface/buildemittedmanifestoptions)
- [`BuildGroupSpec`](silk://packages/tsdown-plugins/api/interface/buildgroupspec) — A prod/dev group to build: its folder id and the resolved package name its manifest carries.
- [`BuildIssues`](silk://packages/tsdown-plugins/api/interface/buildissues) — The aggregated build-issues artifact written to `dist/<target>/issues.json`.
- [`BuildTargetGroupsOptions`](silk://packages/tsdown-plugins/api/interface/buildtargetgroupsoptions)
- [`CopyAmbientDtsOptions`](silk://packages/tsdown-plugins/api/interface/copyambientdtsoptions)
- [`CssOptions`](silk://packages/tsdown-plugins/api/interface/cssoptions) — CSS handling for a partition's JS pass, forwarded VERBATIM to tsdown's `css` option (consumed by `@tsdown/css`). Structurally typed so tsdown-plugins takes no dependency on `@tsdown/css`. The package whose runtime is built must install `@tsdown/css`; tsdown loads it lazily.
- [`DerivedTsdownOptions`](silk://packages/tsdown-plugins/api/interface/derivedtsdownoptions) — The JS pass: per-module JavaScript, no declarations. The build runs TWO tsdown passes per TargetGroup to the SAME outDir: - pass 1 (this) emits per-module JS (`unbundle: true`) with `dts: false` and the default `clean: true`, so it starts from a fresh outDir; - pass 2 (`DerivedDtsPassOptions`) emits ONLY bundled declarations (`unbundle: false`, `dts: { emitDtsOnly: true }`) with `clean: false`, so it must NOT wipe pass 1. We cannot do this in a single pass: tsdown's `unbundle` maps to rolldown `output.preserveModules` for the WHOLE build, and the dts plugin shares it — so one pass gives EITHER per-module JS + per-module dts OR bundled JS + bundled dts. Per-module dts breaks type portability (TS2883) when a package exports only its root entry, and bundling the JS re-bundles workspace consumers (e.g. silk re-bundling silk-effects crashes at runtime). The split keeps per-module JS (no re-bundle hazard) AND bundled, self-contained declarations (no TS2883).
- [`DeriveOptions`](silk://packages/tsdown-plugins/api/interface/deriveoptions)
- [`DiagnosticInput`](silk://packages/tsdown-plugins/api/interface/diagnosticinput)
- [`EmitManifestOptions`](silk://packages/tsdown-plugins/api/interface/emitmanifestoptions)
- [`EntryOverride`](silk://packages/tsdown-plugins/api/interface/entryoverride) — One entry partition built with its own format + bundling posture, layered into the SAME outDir as the base build (clean:false). Anything omitted falls back to the base build's value. `entry` is a subset of the package's entries (`entryName -> source path`).
- [`ExeConfig`](silk://packages/tsdown-plugins/api/interface/execonfig) — One SEA binary to compile.
- [`ExeRewrite`](silk://packages/tsdown-plugins/api/interface/exerewrite) — Describes a SEA binary the bundler compiled for this package. When present, transformManifest rewrites every `exports`/`bin` value equal to `source` to the emitted binary path and adds it to `files` so it ships in the tarball.
- [`ExeSeaConfig`](silk://packages/tsdown-plugins/api/interface/exeseaconfig) — SEA seaConfig overrides (subset; the rest are defaulted).
- [`ExeTarget`](silk://packages/tsdown-plugins/api/interface/exetarget) — A resolved per-platform SEA target. `platform` uses the tsdown/tsdown/exe token (win, not win32).
- [`ExeTargetInput`](silk://packages/tsdown-plugins/api/interface/exetargetinput) — A target before nodeVersion defaulting (platform/arch only).
- [`ExtractAmbientOptions`](silk://packages/tsdown-plugins/api/interface/extractambientoptions)
- [`ExtractOptions`](silk://packages/tsdown-plugins/api/interface/extractoptions)
- [`ExtractResult`](silk://packages/tsdown-plugins/api/interface/extractresult)
- [`Formatter`](silk://packages/tsdown-plugins/api/interface/formatter)
- [`FormatterContext`](silk://packages/tsdown-plugins/api/interface/formattercontext)
- [`GenerateMetaOptions`](silk://packages/tsdown-plugins/api/interface/generatemetaoptions)
- [`JsxConfig`](silk://packages/tsdown-plugins/api/interface/jsxconfig) — Resolved JSX transform settings. The shape mirrors the subset of rolldown's JsxOptions, but the bundler consumes it to populate the generated dts tsconfig's `jsx`/`jsxImportSource`, not by forwarding it into rolldown's input options.
- [`LooseFileSpec`](silk://packages/tsdown-plugins/api/interface/loosefilespec) — One standalone bundled output file, declared by its literal output filename.
- [`MetaOptions`](silk://packages/tsdown-plugins/api/interface/metaoptions) — The `meta` field on defineBuild. Absent means no api-model generation.
- [`MetaResult`](silk://packages/tsdown-plugins/api/interface/metaresult)
- [`ModuleExportNames`](silk://packages/tsdown-plugins/api/interface/moduleexportnames) — The set of names a module exports, plus whether that set is fully known.
- [`NextVersions`](silk://packages/tsdown-plugins/api/interface/nextversions) — Result of resolving next release versions for a workspace.
- [`NormalizedExe`](silk://packages/tsdown-plugins/api/interface/normalizedexe) — Fully-resolved SEA binary spec (no optionals).
- [`NormalizedLooseFile`](silk://packages/tsdown-plugins/api/interface/normalizedloosefile) — A loose file resolved to a concrete build descriptor.
- [`NormalizedMeta`](silk://packages/tsdown-plugins/api/interface/normalizedmeta) — Fully-resolved meta options (no optionals).
- [`PackageJsonEntriesOptions`](silk://packages/tsdown-plugins/api/interface/packagejsonentriesoptions)
- [`PackageJsonLike`](silk://packages/tsdown-plugins/api/interface/packagejsonlike)
- [`PkgOsCpu`](silk://packages/tsdown-plugins/api/interface/pkgoscpu) — The package's own os/cpu fields, used to infer a single platform target.
- [`PlainDiagnostic`](silk://packages/tsdown-plugins/api/interface/plaindiagnostic) — A diagnostic flattened to a plain JSON object (only defined fields are present).
- [`PortableTsconfig`](silk://packages/tsdown-plugins/api/interface/portabletsconfig) — Portable, JSON-serializable tsconfig.json (compilerOptions-only).
- [`PublishTargetObject`](silk://packages/tsdown-plugins/api/interface/publishtargetobject) — A single object-form publish target. Uses `from` XOR `name` (never both).
- [`ReexportBarrelAnalysis`](silk://packages/tsdown-plugins/api/interface/reexportbarrelanalysis) — The analysis of an entry source treated as a candidate re-export barrel.
- [`RenderedOutput`](silk://packages/tsdown-plugins/api/interface/renderedoutput)
- [`RenderReportOptions`](silk://packages/tsdown-plugins/api/interface/renderreportoptions)
- [`ResolvedCompilerOptions`](silk://packages/tsdown-plugins/api/interface/resolvedcompileroptions) — Compiler options with enum values converted to their string equivalents.
- [`ResolvedGroup`](silk://packages/tsdown-plugins/api/interface/resolvedgroup) — A distinct byte-variant build group (one per distinct resolved name).
- [`ResolvedTarget`](silk://packages/tsdown-plugins/api/interface/resolvedtarget) — A resolved registry target (one per `publishConfig.targets` key).
- [`ResolvedTsconfig`](silk://packages/tsdown-plugins/api/interface/resolvedtsconfig)
- [`ResolvedTsconfigOptions`](silk://packages/tsdown-plugins/api/interface/resolvedtsconfigoptions)
- [`RunExeBuildOptions`](silk://packages/tsdown-plugins/api/interface/runexebuildoptions) — Options for compiling SEA binaries.
- [`RunMetaPassOptions`](silk://packages/tsdown-plugins/api/interface/runmetapassoptions) — Options for the meta-pass orchestrator.
- [`TargetGroupRef`](silk://packages/tsdown-plugins/api/interface/targetgroupref)
- [`TargetResolution`](silk://packages/tsdown-plugins/api/interface/targetresolution) — The full resolution of `publishConfig.targets`: the distinct groups to build, and every target bound to one.
- [`Timer`](silk://packages/tsdown-plugins/api/interface/timer)
- [`TransformManifestOptions`](silk://packages/tsdown-plugins/api/interface/transformmanifestoptions)
- [`TsconfigJsx`](silk://packages/tsdown-plugins/api/interface/tsconfigjsx) — The jsx-relevant slice of a tsconfig's compilerOptions.
- [`TsdocOptions`](silk://packages/tsdown-plugins/api/interface/tsdocoptions) — TSDoc / doc-warning configuration. suppressWarnings is doc functionality, so it lives here.
- [`TsdocTagDefinition`](silk://packages/tsdown-plugins/api/interface/tsdoctagdefinition) — A single TSDoc tag definition (parity with api-extractor's TSDoc config).
- [`TsdownLogger`](silk://packages/tsdown-plugins/api/interface/tsdownlogger) — Structural match for tsdown's Logger interface (tsdown 0.22.x).
- [`ValidationInput`](silk://packages/tsdown-plugins/api/interface/validationinput) — The normalized facts the validator checks, assembled by the bundler before any build work.
- [`WarningSuppressionRule`](silk://packages/tsdown-plugins/api/interface/warningsuppressionrule) — An api-extractor message-suppression rule. messageId is exact-matched; pattern (regex or substring) is AND-matched against the text.

## type

- [`BuildFormat`](silk://packages/tsdown-plugins/api/type/buildformat) — An output module format the build can emit.
- [`BuildPlatform`](silk://packages/tsdown-plugins/api/type/buildplatform) — Bundling platform for the JS pass. Defaults to "node". Use "browser" for web runtime partitions.
- [`DtsExportClass`](silk://packages/tsdown-plugins/api/type/dtsexportclass) — Classification of a single export value for ambient-.d.ts handling.
- [`DualExports`](silk://packages/tsdown-plugins/api/type/dualexports) — Which exports get a CJS `require` condition. `true`/`false` apply uniformly to every TS export; a Set marks ONLY the listed export keys (e.g. "./changesets/markdownlint") as dual — used by per-entry format overrides.
- [`Environment`](silk://packages/tsdown-plugins/api/type/environment)
- [`ExeBuild`](silk://packages/tsdown-plugins/api/type/exebuild) — A minimal structural type for tsdown's build, kept loose so this package keeps no tsdown runtime dep (interface-only).
- [`Executor`](silk://packages/tsdown-plugins/api/type/executor)
- [`Json`](silk://packages/tsdown-plugins/api/type/json)
- [`LooseFiles`](silk://packages/tsdown-plugins/api/type/loosefiles) — Map of literal output filename to its source (bare string) or a `{ source, format }` spec.
- [`OutputFormat`](silk://packages/tsdown-plugins/api/type/outputformat)
- [`PassKind`](silk://packages/tsdown-plugins/api/type/passkind)
- [`PublishTargets`](silk://packages/tsdown-plugins/api/type/publishtargets) — The `publishConfig.targets` map, keyed by target id (`npm`, `github`, or a custom key).
- [`PublishTargetValue`](silk://packages/tsdown-plugins/api/type/publishtargetvalue) — A `publishConfig.targets` value: `true` (well-known registry, base name), a string (name override), or an object.
- [`TargetGroupId`](silk://packages/tsdown-plugins/api/type/targetgroupid) — A build group id: "dev" or any prod byte-variant id (e.g. "npm", "github", a custom key).
- [`TsdownBuild`](silk://packages/tsdown-plugins/api/type/tsdownbuild) — Signature compatible with tsdown's `build(inlineConfig)`.

## variable

- [`CiAnnotationsFormatter`](silk://packages/tsdown-plugins/api/variable/ciannotationsformatter)
- [`ConfigValidatorLive`](silk://packages/tsdown-plugins/api/variable/configvalidatorlive) — Live ConfigValidator: wraps the synchronous rule set, surfacing ConfigValidationError as a typed Effect failure.
- [`DEFAULT_EXE_NODE_VERSION`](silk://packages/tsdown-plugins/api/variable/default_exe_node_version) — Default Node runtime embedded in the SEA (parity with the vitest-agent reference).
- [`EnvironmentDetectorLive`](silk://packages/tsdown-plugins/api/variable/environmentdetectorlive)
- [`ExecutorResolverLive`](silk://packages/tsdown-plugins/api/variable/executorresolverlive)
- [`FormatSelectorLive`](silk://packages/tsdown-plugins/api/variable/formatselectorlive)
- [`JsonFormatter`](silk://packages/tsdown-plugins/api/variable/jsonformatter)
- [`MarkdownFormatter`](silk://packages/tsdown-plugins/api/variable/markdownformatter)
- [`OutputRendererLive`](silk://packages/tsdown-plugins/api/variable/outputrendererlive)
- [`ReportPipelineLive`](silk://packages/tsdown-plugins/api/variable/reportpipelinelive)
- [`SilentFormatter`](silk://packages/tsdown-plugins/api/variable/silentformatter)
- [`TerminalFormatter`](silk://packages/tsdown-plugins/api/variable/terminalformatter)
