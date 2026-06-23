# @savvy-web/tsdown-plugins

## 0.9.2

### Bug Fixes

* [`ce970c8`](https://github.com/savvy-web/systems/commit/ce970c8cf390533aab259294c5be38629964ac23) ### Drop the misleading source location from API Extractor diagnostics

API Extractor diagnostics (`ae-*` / `tsdoc-*`) in the build report and `dist/<target>/issues.json` no longer carry `file`, `line`, or `column`. The pass analyzes the bundled `.d.ts` and maps positions back through its source map, which anchored every message to the start of an adjacent declaration rather than the symbol it described — so the reported location pointed at the wrong file. A misleading location is worse than none; the authoritative locator is the symbol name quoted in the diagnostic `text`. Diagnostics from tsdown and rolldown keep their reliable locations.

Because location no longer distinguishes entries, two diagnostics with identical `code` and `text` now coalesce into one artifact entry (most visible for `ae-unresolved-link`, whose `text` names the link target rather than the bearing declaration). This only affects the per-site count for same-text diagnostics; grepping the quoted name still surfaces every site.

## 0.9.1

### Bug Fixes

* [`d7d2c38`](https://github.com/savvy-web/systems/commit/d7d2c381043db29bb952ad162630e8669f048545) Stopped surfacing `@tsdown/css`'s spurious `SOURCEMAP_BROKEN` warnings during dev builds of CSS-module packages (e.g. RSPress plugin runtimes built via `@savvy-web/rspress-builder`). `@tsdown/css` compiles each `.module.css` into a synthesized ESM locals module — a class-name map plus a side-effect import of the extracted CSS — whose transform emits no sourcemap, so rolldown warns that the (empty, meaningless) map "is likely to be incorrect". The build is correct and the warning is unfixable upstream, so `buildMetricsPlugin`'s rolldown `onLog` handler now drops that specific diagnostic (`code === "SOURCEMAP_BROKEN"` from a `@tsdown/css*` plugin) without recording or printing it. All other rolldown warnings — including genuine `SOURCEMAP_BROKEN` from non-CSS plugins — are still reported.

## 0.9.0

### Breaking Changes

* [`356ed32`](https://github.com/savvy-web/systems/commit/356ed32ce08bb1e2971e0522ad7db4144cfa8858) Forgotten exports now fail the build in CI. A forgotten export silently drops the symbol from the generated API model, so in CI (`CI` or `GITHUB_ACTIONS` set) an unsuppressed `ae-forgotten-export` is a hard error. Locally it stays a warning, tagged so the build log can warn that it will fail CI.

- [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) generateBuildReportSchema is no longer exported from @savvy-web/tsdown-plugins. Its Effect signature pulled @effect/platform's FileSystem type (a devDependency) into the published declarations, and the function is internal build tooling with no package-level consumer. If you need it, import it from its source module and provide the FileSystem layer yourself.

### Features

* [`356ed32`](https://github.com/savvy-web/systems/commit/356ed32ce08bb1e2971e0522ad7db4144cfa8858) API Extractor diagnostics now surface in the unified build log. Forgotten exports, missing release tags, and TSDoc issues were previously dropped because API Extractor's default message routing silenced them; they are now reported as warnings during the meta-generation pass.
* Suppressed messages are now accounted for. The build log summarizes how many messages each `suppressWarnings` rule hid, grouped by message id, and `--verbose` lists them in full.

- [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) The self-hosting build libraries now generate their own API model on the prod build. The meta-generation orchestration is unified into a single runMetaPass, exported from @savvy-web/tsdown-plugins and used by both the front-door runBuild and the two escape-hatch self-host builds. @savvy-web/bundler and @savvy-web/tsdown-plugins now emit a dist/prod/issues.json, are API Extractor validated, and publish their API model into the documentation corpus.

* [`81f90f3`](https://github.com/savvy-web/systems/commit/81f90f3e6acc11c0b70be856c676292578fdc7c2) ### Issues artifact

- [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) generateBuildReportSchema is no longer exported from @savvy-web/tsdown-plugins. Its Effect signature pulled @effect/platform's FileSystem type (a devDependency) into the published declarations, and the function is internal build tooling with no package-level consumer. If you need it, import it from its source module and provide the FileSystem layer yourself.

Three new exports — `flattenIssues`, `serializeIssues`, and `writeIssuesArtifact` — write an aggregated `dist/<target>/issues.json` file at the end of every dev/prod build. The artifact collects all warnings, errors, and suppressed diagnostics from the full build report in a stable, de-duplicated JSON format that downstream tooling (agents, CI scripts) can read without parsing terminal output.

```ts
import { writeIssuesArtifact } from "@savvy-web/tsdown-plugins";

// Called automatically by runBuild; also available directly for custom pipelines.
const outPath = writeIssuesArtifact({ cwd, target: "prod", reports });
// → "path/to/dist/prod/issues.json"
```

Two supporting types are also exported: `BuildIssues` (the artifact schema) and `PlainDiagnostic` (a single flattened diagnostic entry).

### Build System

* [`81f90f3`](https://github.com/savvy-web/systems/commit/81f90f3e6acc11c0b70be856c676292578fdc7c2) Suppressed the `ae-internal-missing-underscore` API Extractor diagnostic. The underscore-prefix convention for `@internal` exports is not used in this monorepo, so the warning was noise; it is now silenced by default in the extracted message configuration.

## 0.8.0

### Features

* [`8b4ca43`](https://github.com/savvy-web/systems/commit/8b4ca43411dc53e0d7e41ea5fa9fd41b9682ae7a) ### BuildCollector and structured diagnostics

Adds a stateful `BuildCollector` class (and its Effect `BuildCollectorTag`) that accumulates build metrics, warnings, and errors across all phases of a build. Callers that want a unified snapshot instead of per-pass console output can instantiate one collector, pass it through `buildTargetGroups` and `runExeBuild`, then call `collector.snapshot(packageName)` to obtain the immutable `BuildReport`.

Warnings and errors from tsdown's logger, rolldown's `onLog`, and API Extractor's `messageCallback` are all funneled into the collector — the build runs silently to stdout and delivers a single structured report at the end.

```ts
import { BuildCollector, buildTargetGroups } from "@savvy-web/tsdown-plugins";

const collector = new BuildCollector();
await buildTargetGroups({ ...options, collector, verbose: false });
const [report] = collector.snapshot("my-package");
// report.targetGroups[0].passes   — per-pass file lists
// report.targetGroups[0].warnings — structured DiagnosticEntry[]
```

### createTsdownLogger and buildMetricsPlugin

`createTsdownLogger(collector, groupId)` returns a tsdown `customLogger` that routes warnings and errors into the collector. Pair it with `logLevel: "silent"` on the tsdown config to suppress console noise while still capturing all diagnostics.

`buildMetricsPlugin(collector, groupId, pass)` is a rolldown `writeBundle` plugin that records each emitted output file (path and byte size) into the collector after every bundle pass.

Both are exported from the package root and intended for use when integrating the collector into a custom build driver.

### Restructured BuildReport schema

The `BuildReport` and `TargetGroupReport` types have been restructured. If you import these types, update your code as follows.

Before:

```ts
interface TargetGroupReport {
  emittedFiles: string[];
  warnings: string[];
  errors: string[];
  // ...
}
```

After:

```ts
interface TargetGroupReport {
  passes: PassReport[]; // per-pass (js / dts / loose / exe / meta)
  warnings: DiagnosticEntry[];
  errors: DiagnosticEntry[];
  // ...
}

interface PassReport {
  id: "js" | "dts" | "loose" | "exe" | "meta";
  files: EmittedFile[];
  ms: number;
}

interface DiagnosticEntry {
  source: "tsdown" | "rolldown" | "api-extractor";
  level: "warn" | "error";
  text: string;
  file?: string;
  line?: number;
  column?: number;
}
```

New exported types: `DiagnosticEntry`, `DiagnosticInput`, `EmittedFile`, `PassKind`, `PassReport`, `TsdownLogger`.

### Quiet terminal output with optional verbose detail

The terminal formatter is now quiet by default: one summary line per target group showing file count and elapsed time. Pass `verbose: true` (via the collector options or the `--verbose` CLI flag on the bundler) to emit the full per-file listing. Markdown and CI-annotation formatters consume the structured `DiagnosticEntry` objects directly.

### Bin entries excluded from declaration output

The dts pass now skips `bin/` (executable) entries. A bin file is a side-effect-only executable with no exports and no consumer importing its types, so its declaration is never useful — and its empty `export {}` chunk made `rolldown-plugin-dts` emit a spurious `SOURCEMAP_BROKEN` warning on every build of a package that ships a bin. The bin executable's JavaScript still builds as before; only its empty declaration file is no longer emitted. A package whose only entry is a bin produces no dts pass at all.

### Deduplicated captured warnings

Identical diagnostics captured from more than one build pass (for example a warning that fires in both the JS and dts passes of a dual-format entry) are now reported once per target group instead of repeated, and captured rolldown warnings no longer leak to the console alongside the unified report.

## 0.7.0

### Features

* [`e1770be`](https://github.com/savvy-web/systems/commit/e1770be81dc502eb7b1eac8c7c4efdf58ccf6cd0) Generate the API Extractor meta bundle from the production build instead of the
  development build, so the package manifest copied into the configured local
  paths carries fully resolved dependency versions. Previously the meta manifest
  came from the dev output and kept unresolved workspace and catalog protocol
  specifiers, which left documentation tooling such as Twoslash and the MCP API
  doc pipeline unable to wire in dependency types. The production target now emits
  a meta bundle for every publish group and copies the canonical group's bundle
  into the configured local paths.

Add an optimistic meta option that forward-looks the meta manifest. When enabled
it rewrites the bundle's own version and any workspace sibling dependency
version to the next release version computed from pending changesets, so a local
build's meta bundle matches the state of the next release. The option is auto by
default, which resolves to off in CI and on locally, and can be set explicitly.
The rewrite affects the meta bundle only and never the published package
manifest. The tsdown-plugins package gains the supporting building blocks: a
next-version resolver over the changeset release plan, a pure version-rewrite
transform, a manifest transform hook on the meta generator, and the optimistic
field on the meta options.

The standalone meta build target is soft-deprecated. It now warns and performs
no work, because meta is emitted as part of the production build. The target
flag, its turbo task, and the per-package scripts remain in place for now and
will be removed in a later change.

## 0.6.0

### Features

* [`2d7893a`](https://github.com/savvy-web/systems/commit/2d7893afbd2f82324f94a2a70eeeac2ee4b28b89) ### SEA building blocks: computed filenames, entry exclusion, and manifest rewrite

Three new primitives let a build emit a single-executable (SEA) binary and program the package manifest to point at it, so an author never hand-writes the platform-suffixed filename:

* `computeExeFileName(fileName, target)` (`src/exe/filename.ts`) mirrors `@tsdown/exe`'s output naming — `fileName + getTargetSuffix(target) + (win ? ".exe" : "")`, with the platform token rendered as `win` (not `win32`). It is the single source of truth for the on-disk name, so the manifest value cannot drift from the emitted file.
* `extractEntries({ excludeSources })` drops any `exports`/`bin` value equal to the exe entry source, so a pure-binary package yields zero JS entries — no dead `bin/<cmd>.js` stub and no `No input files` error — while a library-plus-binary package still compiles its other exports.
* `transformManifest({ exeRewrite })` rewrites every `exports`/`bin` value equal to the exe source to the emitted SEA path (a plain string, since a SEA has no `.d.ts`) and adds the binary to `files` so it ships in the tarball.

`exeRewrite` threads through `buildEmittedManifest`, `emitManifest`, and `buildTargetGroups`.

## 0.5.0

### Features

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) ### Platform and CSS support for entry override partitions

`EntryOverride` gains three new fields that let a single `defineBuild` produce a mixed-target package — for example, a Node plugin entry alongside a browser React runtime:

* `platform` (`BuildPlatform: "node" | "browser" | "neutral"`) — sets the JS-pass build platform for the partition. Defaults to `"node"`. Use `"browser"` for a web runtime that must run in a browser bundler rather than Node.
* `css` (`CssOptions`) — forwarded verbatim to tsdown's `css` option (consumed by `@tsdown/css`). Enables CSS modules for a partition's JS pass. The package being built must install `@tsdown/css`; tsdown loads it lazily.
* `outSubdir` (`string`) — builds the partition into an isolated `<groupOutDir>/<outSubdir>/` subdirectory instead of the shared group root. Isolates the sub-package so its bundleless per-file output cannot collide with the base partition, and gives it a deterministic barrel path (`<outSubdir>/index.js` + `<outSubdir>/index.d.ts`). Pin exactly one export path per `outSubdir` override.

```ts
// defineBuild overrides — plugin (node, bundled) + runtime (browser, bundleless, CSS modules)
overrides: [
  {
    entries: ["./runtime"],
    outSubdir: "runtime",
    platform: "browser",
    css: {
      modules: { localsConvention: "camelCaseOnly", namedExport: false },
      inject: true,
    },
    externals: ["react", "react/jsx-runtime", "@rspress/core", "@theme"],
  },
];
```

Two new types are exported from the package root: `BuildPlatform` and `CssOptions`.

### Bug Fixes

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) Declaration file inputs (`.d.ts`, `.d.cts`, `.d.mts`) are now treated as pass-through assets rather than TypeScript source files to build. Previously, a `.d.ts` export target was misclassified as a buildable TypeScript entry, producing a spurious `.d.ts.js` output and a crash when the dts pass tried to compile it. The fix affects both the entry extractor (`src/entry/extract.ts`) and the manifest transform (`src/manifest/transform.ts`).

The portable tsconfig resolver now maps `ScriptTarget.ES2025` to `"es2025"`. Previously the resolver's target table stopped at ES2024, so a package targeting `es2025` emitted an invalid `"es12"` numeric fallback in its generated meta tsconfig.

### Subdirectory export manifest support

`BuildTargetGroupsOptions` gains a `subdirExports` field (`ReadonlySet<string>`). Export keys listed in `subdirExports` have their `package.json` export conditions rewritten to point at the isolated `<key>/index.*` subdir path rather than the flat `<name>.js` path. This is threaded automatically by `buildTargetGroups` when any override sets `outSubdir`.

## 0.4.2

### Dependencies

* | [`56fc55a`](https://github.com/savvy-web/systems/commit/56fc55aceb389c10ab8da1c962a464c758a936fc) | Dependency | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :------ | :------ | -- |
  | @microsoft/api-extractor                                                                          | dependency | updated | ^7.58.8 | ^7.58.9 |    |

## 0.4.1

### Dependencies

* | [`e6e3ee4`](https://github.com/savvy-web/systems/commit/e6e3ee464b9e5ae56e45acbf03b583e1bc11d7c3) | Dependency | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :------ | :------ | -- |
  | @microsoft/api-extractor                                                                          | dependency | updated | ^7.58.8 | ^7.58.9 |    |

### Other

* [`49f5733`](https://github.com/savvy-web/systems/commit/49f5733639fa87562813b2c52c06293970409a43) Lock tsdown peer versioning.

## 0.4.0

### Features

* [`2675852`](https://github.com/savvy-web/systems/commit/26758526060024d616a059799c04cd7965b57360) A `normalizeLooseFiles` helper and `looseFiles` support in `buildTargetGroups`. Each loose file builds as one extra single-entry, bundled, declaration-free, manifest-free tsdown pass per target group, inheriting the group's bundling posture so the output is self-contained. The `ConfigValidator` validates loose files structurally (supported extension, format inference, and contradiction checks) before any build work.

## 0.3.0

### Features

* [`bffeffe`](https://github.com/savvy-web/systems/commit/bffeffee4f7d1b9decfbc040790650bfee2e7667) ### `define` threaded through `buildTargetGroups`

`buildTargetGroups` and the derive helpers now accept and forward a `define` map — compile-time global replacements passed through to each tsdown/rolldown build group. Merged with the auto-injected `process.env.__PACKAGE_VERSION__` define; user keys of the same name win.

### Bug Fixes

* [`bffeffe`](https://github.com/savvy-web/systems/commit/bffeffee4f7d1b9decfbc040790650bfee2e7667) The auto-injected package version `define` key was the bare identifier `__PACKAGE_VERSION__`. rolldown matches `define` keys against token occurrences, so the bare identifier never replaced the `process.env.__PACKAGE_VERSION__` member expression that consumers actually read. The key is now `process.env.__PACKAGE_VERSION__`, restoring correct version injection at build time.

### Auto `./package.json` export in built manifests

`transformManifest` now automatically injects `"./package.json": "./package.json"` into a package's `exports` map when an `exports` field is present and the entry is absent. This follows standard npm practice and allows consumers to import the package's own manifest:

```ts
import pkg from "my-package/package.json" assert { type: "json" };
```

The injection runs before any user-supplied `transform`, so a custom transform can still remove the entry if needed. Packages that declare no `exports` field at all are unaffected (they already expose everything).

## 0.2.1

### Dependencies

* | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | sort-package-json                                                                                 | dependency | updated | ^3.6.1 | ^4.0.0 |    |

## 0.2.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Initial `@savvy-web/tsdown-plugins` program — the interface-only tsdown/rolldown plugin pack

Holds every build behavior behind the `@savvy-web/bundler` orchestrator: entry detection, manifest transforms + catalog delegation over `workspaces-effect`'s `CatalogResolver`, the dts resolved-tsconfig port, the name-aware two-pass `buildTargetGroups` (per-module JS pass + bundled `emitDtsOnly` dts pass), the Effect output reporter, the `src/meta/` API Extractor pipeline (`generateMeta`, portable-tsconfig resolver, `syncPublicDir`), the `src/targets/` derivation (`resolveTargets`/`writeTargetsBinding`, throwing `ConfigValidationError`), the `src/jsx/` config, and the `src/exe/` SEA support.

Includes M1 dual-format threading, M3 bundled dts (TS2883 fix), M4-M6 bundling-posture capabilities, per-entry override partitions, the `defaultManifestTransform`/`removeDeclarationMaps` helpers, the synced `ecma.json` copy, and the `ConfigValidator` rule set. Authored against rolldown's `Plugin` type only (no tsdown peer).

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
* Strip prod `.d.ts.map`/`.d.cts.map` from published output.

### Self-hosting build now emits the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.

## 0.1.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Initial `@savvy-web/tsdown-plugins` program — the interface-only tsdown/rolldown plugin pack

Holds every build behavior behind the `@savvy-web/bundler` orchestrator: entry detection, manifest transforms + catalog delegation over `workspaces-effect`'s `CatalogResolver`, the dts resolved-tsconfig port, the name-aware two-pass `buildTargetGroups` (per-module JS pass + bundled `emitDtsOnly` dts pass), the Effect output reporter, the `src/meta/` API Extractor pipeline (`generateMeta`, portable-tsconfig resolver, `syncPublicDir`), the `src/targets/` derivation (`resolveTargets`/`writeTargetsBinding`, throwing `ConfigValidationError`), the `src/jsx/` config, and the `src/exe/` SEA support.

Includes M1 dual-format threading, M3 bundled dts (TS2883 fix), M4-M6 bundling-posture capabilities, per-entry override partitions, the `defaultManifestTransform`/`removeDeclarationMaps` helpers, the synced `ecma.json` copy, and the `ConfigValidator` rule set. Authored against rolldown's `Plugin` type only (no tsdown peer).

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
* Strip prod `.d.ts.map`/`.d.cts.map` from published output.

### Self-hosting build now emits the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.
