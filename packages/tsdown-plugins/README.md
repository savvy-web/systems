# @savvy-web/tsdown-plugins

[![npm](https://img.shields.io/npm/v/@savvy-web%2Ftsdown-plugins?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/tsdown-plugins)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The plugin pack behind [`@savvy-web/bundler`](https://www.npmjs.com/package/@savvy-web/bundler). It holds every build behavior the bundler drives — entry detection, manifest emission and catalog resolution, the dts tsconfig port, the per-target build loop and the build-output reporter — as composable helpers and one [rolldown](https://rolldown.rs/) plugin. It is authored against rolldown's plugin _type_ only, so it imports no `tsdown` runtime and declares no `tsdown` peer dependency: bring your own `tsdown`.

Most packages should use `@savvy-web/bundler` directly. Reach for this package when you have outgrown the bundler's front door and want to compose the same building blocks in a hand-written `tsdown.config.ts`.

## Install

```bash
npm install --save-dev @savvy-web/tsdown-plugins tsdown
# or
pnpm add -D @savvy-web/tsdown-plugins tsdown
```

`tsdown` is a peer of your own choosing — the plugin pack never pins it.

## Quick start

Compose the helpers in a `tsdown.config.ts` to reproduce the bundler's front door yourself:

```ts
// tsdown.config.ts
import { packageJsonEntries, emitManifest } from "@savvy-web/tsdown-plugins";
import { defineConfig } from "tsdown";

const sourceDir = process.cwd();

export default defineConfig({
  entry: packageJsonEntries({ cwd: sourceDir }),
  // emitManifest writes a transformed, catalog-resolved package.json into the output pkg/
  plugins: [emitManifest({ sourceDir, targetGroup: { id: "npm", isProd: true } })],
});
```

`packageJsonEntries` reads a package's `exports` and `bin` and returns the `Record<name, path>` that `tsdown` accepts as `entry`. `emitManifest` reads the `package.json` under `sourceDir`, writes the transformed manifest and copies `LICENSE`/`README.md` into the output folder.

## Features

- **Entry detection** — `packageJsonEntries` and `extractEntries` derive build entries from a package's `exports` and `bin`, matching the rules used across the Silk Suite builders.
- **Manifest transforms** — `transformManifest`, `transformExports`, `transformBin` and `normalizeBinPaths` rewrite a source `package.json` into a publishable one; `emitManifest` is the rolldown plugin that writes it. A dual-format build emits both `import` and `require` export conditions, and a `"./package.json": "./package.json"` entry is added to the exports map so consumers can `import "<pkg>/package.json"`.
- **Ambient `.d.ts` exports** — `extractAmbientDts` and `classifyDtsExport` pick the types-only, hand-authored declaration exports out of a package's `exports` map; `transformExports` rewrites each to a key-derived `{ types }` pointer and `copyAmbientDts` copies the source declaration verbatim into every target dir, preserving its extension. `findRelativeSpecifiers` rejects a non-self-contained declaration and `mixedDtsExportError` rejects an export that mixes a hand-authored `types` with a runtime source.
- **Catalog resolution** — `resolveManifest` resolves `catalog:` and `workspace:` specifiers against the workspace, delegating to [`@effected/workspaces`](https://www.npmjs.com/package/@effected/workspaces). It rejects with a typed error rather than a defect: `ManifestDecodeError` when a dependency field is not a string-to-string record, `UnresolvedDependencyError` on a specifier the workspace cannot answer, and `CatalogAssemblyError`/`DependencyResolutionError` when catalog assembly or the resolution mechanism itself fails. All four are exported.
- **Multi-target resolution** — `resolveTargets` turns a `publishConfig.targets` map into the distinct byte-variant groups to build and the registry bindings for each; `writeTargetsBinding` persists that resolution as `dist/prod/targets.json` for the release step.
- **JSX resolution** — `resolveJsxConfig` and `readTsconfigJsx` derive the effective JSX transform from a package's tsconfig, with an explicit override winning. The tsconfig is read through a loader that honors JSONC syntax and `extends` chains, so a `jsx` setting inherited from a base config resolves.
- **Executable binaries** — `normalizeExeOptions` fills the SEA defaults and infers targets from the package's `os`/`cpu`; `runExeBuild` drives `@tsdown/exe` to compile the binaries.
- **Config validation** — the `ConfigValidator` Effect service (with `ConfigValidatorLive`) fast-fails on a bad `publishConfig.targets`, `exe` or `meta` config, raising the typed `ConfigValidationError`.
- **dts tsconfig port** — `buildResolvedTsconfig` and `writeResolvedTsconfig` write a temp tsconfig with absolute paths so type declarations emit cleanly under pnpm symlinks.
- **Per-target build loop** — `deriveTargetGroupOptions` and `buildTargetGroups` map a target to its `tsdown` options and run the build once per target, exposed as a helper so the escape hatch gets multi-target builds too. A `format` of `["esm", "cjs"]` (the `BuildFormat` type) derives a dual-format build — a require-able CJS output with default-export interop and `.d.cts` declarations alongside the ESM one. The `bundleNodeModules`, `bundledPackages` and `dtsExternals` options thread the dependency-bundling posture into both the JS and declaration passes. A per-entry override partition can also set `platform` (the JS-pass target, `"browser"` for a client bundle), `css` (forwarded to tsdown's `css` option for `@tsdown/css`) and `outSubdir` (build the partition into an isolated `<group>/pkg/<subdir>/` sub-package). The `define` option forwards compile-time global replacements to both passes, merged with an auto-injected `process.env.__PACKAGE_VERSION__` constant.
- **Loose files** — `normalizeLooseFiles` resolves a `LooseFiles` map of literal output filenames to `NormalizedLooseFile` descriptors, inferring the module format from each `.mjs`/`.cjs` key and raising `ConfigValidationError` on a path separator, an unsupported extension or an ambiguous `.js`. `buildTargetGroups` takes the normalized form as its `looseFiles` option and emits one extra single-entry, bundled, declaration-free and manifest-free pass per file per target group, inheriting the group's bundling posture so each file is self-contained.
- **Bundled declarations** — each target runs two `tsdown` passes: a JavaScript pass that preserves per-module output, then a declaration-only pass that rolls every re-exported type into a single `.d.ts` per public entry (`deriveDtsPassOptions`). Per-module JavaScript stays intact while consumers keep reaching re-exported types through your published subpaths.
- **API Extractor meta** — `runMetaPass` is the single meta-generation orchestrator the bundler front door and both self-hosting escape hatches share: it derives the export paths, applies the optimistic next-version forward-look and drives API Extractor over a package's emitted `.d.ts` to write an api-model bundle (`.api.json`, `tsdoc-metadata.json`, resolved `tsconfig.json`). `generateMeta` is the lower-level pass it wraps, and `normalizeMetaOptions` fills the `MetaOptions` defaults that drive it.
- **Output reporter** — `renderReport` plus the `BuildReport` schema and a set of formatters (terminal, JSON, markdown, CI annotations, silent) render a build report for humans, agents or CI.
- **Issues artifact** — `writeIssuesArtifact` (with the pure `flattenIssues` and `serializeIssues` behind it) writes a deduplicated `dist/<target>/issues.json` on every build, successful or failed, collecting the build's warnings, errors and suppressed diagnostics in a stable JSON shape (`BuildIssues`/`PlainDiagnostic`) so an agent or CI script reads the diagnostics straight from disk instead of parsing terminal output. The artifact lands through a temp file and a rename, so a concurrent reader sees the previous file or the complete new one, never a half-written one.

## Reading the issues artifact

`dist/<target>/issues.json` is written on every terminal path — the build that finished and the build that blew up both leave one behind. Read the `buildOk` field before you read anything else: a crashed build leaves `warnings`, `errors` and `suppressed` empty, which is byte-for-byte what a clean build writes, so empty buckets alone prove nothing. When `buildOk` is `false`, the optional `failure` object carries the terminal error's `name` and `message` (truncated at 2000 characters).

```bash
jq -c '{ ok: .buildOk, errors: (.errors | length) }' dist/prod/issues.json
# {"ok":true,"errors":0}    a build that ran to completion with no diagnostics
# {"ok":false,"errors":0}   a build that died before it could report any
```

An artifact produced before the field existed has no `buildOk` at all. Treat a missing value as unknown, not as a pass. If you drive `writeIssuesArtifact` yourself from a hand-written config, it defaults `buildOk` to `true` — pass `buildOk: false` (and a `failure`) explicitly from your own error path, or your artifact will claim a clean gate the build never reached.

## Effect

The package is implemented in [Effect](https://effect.website/), but Effect runs behind the plugin boundary: the catalog wrapper returns a `Promise` and the reporter is rendered with `Effect.runPromise` at the call site. The plugin and helper values you compose are plain rolldown-conformant objects. `effect` and its `@effect/*` companions ship as regular dependencies, so you install nothing extra and your project's own Effect versions never affect the plugin pack.

## License

[MIT](LICENSE)
