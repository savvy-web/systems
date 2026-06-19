# @savvy-web/tsdown-plugins

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
