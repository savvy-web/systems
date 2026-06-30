# @savvy-web/bundler

## 1.0.1

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so the package picks up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds a `LICENSE` file and minor `tsconfig.json` corrections. No runtime behavior changes.
  | Dependency                | Type       | Action  | From  | To    |
  | ------------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/tsdown-plugins | dependency | updated | 1.0.0 | 1.0.1 |

## 1.0.0

### Breaking Changes

* [`ceeca34`](https://github.com/savvy-web/systems/commit/ceeca34f4ac4b7fdca7321c5016321f5be084768) ### Public asset contents are copied into the package

Packages built with `@savvy-web/bundler` that have a `public/` directory now have its CONTENTS copied into the built package — only the `public/` directory segment is dropped; the substructure under it is preserved. An asset at `public/tsconfig/ecma.json` previously landed at `dist/dev/pkg/public/tsconfig/ecma.json`; it now lands at `dist/dev/pkg/tsconfig/ecma.json`.

Keep your `package.json` `exports` values pointing into `./public/` — the build strips the `public/` segment from each value when it emits the published manifest, so the copied file still resolves. A source export of:

```json
{
  "exports": {
    "./tsconfig/ecma.json": "./public/tsconfig/ecma.json"
  }
}
```

publishes as:

```json
{
  "exports": {
    "./tsconfig/ecma.json": "./tsconfig/ecma.json"
  }
}
```

### Features

* [`ceeca34`](https://github.com/savvy-web/systems/commit/ceeca34f4ac4b7fdca7321c5016321f5be084768) ### `build()` front door

`build(input?, overrides?)` is the new canonical form for `savvy.build.ts` files. It combines `defineBuild` and `runBuild` in a single call, deriving `cwd` from the entry script directory (`process.argv[1]`) and `argv` from `process.argv.slice(2)` — the faithful equivalent of `import.meta.dirname` without requiring ESM module metadata.

```ts
import { build } from "@savvy-web/bundler";

await build({/* BuildConfigInput options */});
```

`defineBuild` and `runBuild` remain exported. The second argument of `build()` accepts `Partial<RunOptions>` for injectables useful in tests or custom IO.

* [`8078799`](https://github.com/savvy-web/systems/commit/8078799b0261729efe897f1084ed532348f3a1b6) ### Ambient `.d.ts` exports

`runBuild` now validates types-only hand-authored declaration exports early — on every target path, before any build step runs — and copies each source verbatim into every built package dir (`dist/dev/pkg` on `--target dev`; `dist/prod/<group>/pkg` per prod group on `--target prod`).

New injectable on `RunOptions`:

```ts
/** Injectable ambient-.d.ts copier (defaults to copyAmbientDts from @savvy-web/tsdown-plugins). */
readonly copyAmbientDts?: (o: CopyAmbientDtsOptions) => void;
```

`extractAmbientDts` and `AmbientDtsEntry` are re-exported from `@savvy-web/bundler` for use in a custom `transform` that needs to inspect the ambient entry list without a direct `@savvy-web/tsdown-plugins` import.

### Patch Changes

| Dependency                | Type       | Action  | From   | To    |
| ------------------------- | ---------- | ------- | ------ | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.12.0 | 1.0.0 |

## 0.12.0

### Features

* [`2ab83d4`](https://github.com/savvy-web/systems/commit/2ab83d477f07258cf1e0387b908b807743051db0) ### Deterministic, self-contained per-entry declarations

The declaration pass now emits one self-contained `.d.ts` per public entry instead of rolling every entry through a single multi-entry pass. A multi-entry package no longer produces a cross-entry, content-hashed shared declaration chunk, so its declaration output is stable across clean rebuilds.

* A secondary entry that is a pure named re-export of a subset of the primary `index` entry is emitted as a thin `export { … } from "./index.js"` stub instead of re-inlining the shared surface, so re-export-heavy multi-entry packages stay compact.
* The declaration-emit TypeScript pass runs with `stableTypeOrdering`, so union and type members serialize in a stable order across builds. It is scoped to the emit pass only, so the bundled API Extractor (which predates the flag) is unaffected.

### Bug Fixes

* [`2ab83d4`](https://github.com/savvy-web/systems/commit/2ab83d477f07258cf1e0387b908b807743051db0) Declaration (`.d.ts`) and API-model (`.api.json`) output is now byte-reproducible across repeated clean builds of multi-entry packages. Previously the shared declaration chunk's name and layout, plus TypeScript union-member ordering, varied between otherwise-identical builds.

### Patch Changes

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/tsdown-plugins | dependency | updated | 0.11.2 | 0.12.0 |

## 0.11.2

### Bug Fixes

* [`577d242`](https://github.com/savvy-web/systems/commit/577d242edd260dc75a04d6b95e3ffc33a3e040c0) Removed the `jsx` forward from `run.ts` into the `buildTargetGroups` call. JSX builds — including RSPress runtime builds via `@savvy-web/rspress-builder` — no longer emit a spurious rolldown "Invalid input options" warning. Emitted JS and `.d.ts` output is unchanged.
  | Dependency                | Type       | Action  | From   | To     |
  | ------------------------- | ---------- | ------- | ------ | ------ |
  | @savvy-web/tsdown-plugins | dependency | updated | 0.11.1 | 0.11.2 |

## 0.11.1

### Dependencies

* | [`689a1aa`](https://github.com/savvy-web/systems/commit/689a1aa25f72a4521ff8e21c3fd610862247a0ce) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | rolldown                                                                                          | dependency | updated | ^1.1.2 | ^1.1.3 |    |

## 0.11.0

### Features

* [`a92e92f`](https://github.com/savvy-web/systems/commit/a92e92f7069eaf83a686806b95d87afc841f0033) ### `plugins` option on `defineBuild`

`defineBuild` now accepts a `plugins?: ReadonlyArray<Plugin>` option (the rolldown `Plugin` type, re-exported from `@savvy-web/bundler`). The supplied plugins are forwarded to EVERY tsdown run the build performs — the JS pass, the bundled-dts pass, the per-module declarations pass, and each `looseFiles` pass — so build-time codegen and virtual-module plugins fire across the whole build.

The driver is the pnpm config-dependency flow: a consumer's `looseFiles` pnpmfile can `import` a virtual module that a config plugin serves via `resolveId`/`load`, because the user plugin runs on the `looseFiles` pass where the pnpmfile is bundled.

The rolldown `Plugin` type is also re-exported by name from `@savvy-web/bundler` so consumers do not need a direct dependency on `rolldown` to type their plugins. `rolldown` is now a direct dependency of `@savvy-web/bundler` (previously transitive via `tsdown`) so the `Plugin` type stays an external reference in the emitted declarations and resolves for consumers.

```ts
import { defineBuild, runBuild, type Plugin } from "@savvy-web/bundler";
import { PnpmConfigPlugin } from "pnpm-config-builder";

export default defineBuild({
  plugins: [PnpmConfigPlugin()],
  bundleNodeModules: true,
  looseFiles: {
    "pnpmfile.mjs": "./src/pnpmfile.ts",
    "pnpmfile.cjs": "./src/pnpmfile.ts",
  },
});
```

Forwarding the plugins to each pass needed no change to `@savvy-web/tsdown-plugins` — the per-pass `extraPlugins` plumbing already existed.

### Patch Changes

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/tsdown-plugins | dependency | updated | 0.10.0 | 0.11.0 |

## 0.10.0

### Features

* [`d7fd974`](https://github.com/savvy-web/systems/commit/d7fd9740ee58347e0c2c92af66edb8289016dd80) `--target prod` builds now emit a per-module declaration tree (`dist/prod/<id>/declarations/`) so that the `@savvy-web/tsdown-plugins` meta pass can recover accurate `file`/`line`/`column` on API Extractor diagnostics. The bundler passes `emitDeclarations: true` to the build loop automatically when running a prod target; no `savvy.build.ts` changes are required.

### Patch Changes

| Dependency                | Type       | Action  | From  | To     |
| ------------------------- | ---------- | ------- | ----- | ------ |
| @savvy-web/tsdown-plugins | dependency | updated | 0.9.2 | 0.10.0 |

## 0.9.2

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.9.1 | 0.9.2 |

## 0.9.1

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.9.0 | 0.9.1 |

## 0.9.0

### Breaking Changes

* [`356ed32`](https://github.com/savvy-web/systems/commit/356ed32ce08bb1e2971e0522ad7db4144cfa8858) Forgotten exports now fail the build in CI. When `CI` or `GITHUB_ACTIONS` is set, an unsuppressed `ae-forgotten-export` diagnostic is a hard error that aborts the build. Locally it stays a warning, tagged in the build log to indicate it will fail CI.

To suppress the error (and its local warning), add the rule to `tsdoc.suppressWarnings` in your `defineBuild` config:

```ts
const config = defineBuild({
  meta: {
    tsdoc: {
      suppressWarnings: [{ messageId: "ae-forgotten-export" }],
    },
  },
});
```

### Features

* [`356ed32`](https://github.com/savvy-web/systems/commit/356ed32ce08bb1e2971e0522ad7db4144cfa8858) API Extractor diagnostics now surface in the build log when you run `runBuild`. Forgotten exports, missing release tags, and TSDoc issues that were previously dropped by API Extractor's default message routing are now reported as warnings during the meta-generation pass. Suppressed messages are accounted for: the build log summarizes how many messages each `suppressWarnings` rule hid, grouped by message id, with `--verbose` listing them in full.

- [`81f90f3`](https://github.com/savvy-web/systems/commit/81f90f3e6acc11c0b70be856c676292578fdc7c2) ### Issues artifact written on every build

`runBuild` now writes `dist/<target>/issues.json` at the end of every dev and prod build. The file contains all warnings, errors, and suppressed diagnostics from the build in a stable, de-duplicated JSON format.

```ts
// No config change required — the artifact is written automatically.
await runBuild(config, options);
// → dist/dev/issues.json and dist/prod/issues.json are created alongside the bundle.
```

A new injectable `writeIssues` option on `RunOptions` lets tests or custom pipelines swap the writer without touching the filesystem:

* [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) generateBuildReportSchema is no longer exported from @savvy-web/tsdown-plugins. Its Effect signature pulled @effect/platform's FileSystem type (a devDependency) into the published declarations, and the function is internal build tooling with no package-level consumer. If you need it, import it from its source module and provide the FileSystem layer yourself.

```ts
await runBuild(config, {
  writeIssues: ({ cwd, target, reports }) => {
    // custom writer — return the path written
    return myWriter(cwd, target, reports);
  },
});
```

* [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) The self-hosting build libraries now generate their own API model on the prod build. The meta-generation orchestration is unified into a single runMetaPass, exported from @savvy-web/tsdown-plugins and used by both the front-door runBuild and the two escape-hatch self-host builds. @savvy-web/bundler and @savvy-web/tsdown-plugins now emit a dist/prod/issues.json, are API Extractor validated, and publish their API model into the documentation corpus.

### Dependencies

* | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency    | Type    | Action                | From                  | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :-------------------- | :-------------------- | -- |
  | effect                                                                                            | dependency    | updated | ^3.21.3               | ^3.21.4               |    |
  | @effect/platform                                                                                  | devDependency | updated | ^0.96.1               | ^0.96.2               |    |
  | @typescript/native-preview                                                                        | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |    |
  | @types/node                                                                                       | devDependency | updated | ^25.9.0               | ^26.0.0               |    |
  | Dependency                                                                                        | Type          | Action  | From                  | To                    |    |
  | -------------------------                                                                         | ----------    | ------- | -----                 | -----                 |    |
  | @savvy-web/tsdown-plugins                                                                         | dependency    | updated | 0.8.0                 | 0.9.0                 |    |

## 0.8.0

### Features

* [`8b4ca43`](https://github.com/savvy-web/systems/commit/8b4ca43411dc53e0d7e41ea5fa9fd41b9682ae7a) ### Unified build log

`runBuild` now threads a `BuildCollector` through every phase (dev, prod, exe, meta) and renders a single unified build report at the end, replacing the previous output that interleaved raw tsdown console lines with a hollow "0 files emitted" summary. The report groups output by target group, shows file counts and timing per pass, and surfaces any warnings or errors collected during the run.

### --verbose flag

Pass `--verbose` to `savvy build` to include a full per-file listing (path and size) in the build report.

```sh
savvy build --target dev
# npm   3 files  1.24s
# prod  6 files  2.01s

savvy build --target dev --verbose
# npm
#   dist/dev/pkg/index.js          12.4 kB
#   dist/dev/pkg/index.d.ts         3.1 kB
#   ...
```

### Diagnostics surfaced on failure

When a build phase fails, any warnings and errors collected up to that point are rendered before the error propagates. Previously diagnostics were swallowed and only the raw exception was shown.

The escape-hatch `savvy.build.ts` self-host scripts emit the same unified log.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.7.0 | 0.8.0 |

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

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.6.0 | 0.7.0 |

## 0.6.1

### Dependencies

* | [`c0ae4b9`](https://github.com/savvy-web/systems/commit/c0ae4b95ef2a581445c51b3a78e17590be612951) | Dependency    | Type    | Action               | From                 | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :------------------- | :------------------- | -- |
  | tsdown                                                                                            | dependency    | updated | ^0.22.2              | ^0.22.3              |    |
  | @typescript/native-preview                                                                        | devDependency | updated | 7.0.0-dev.20260614.1 | 7.0.0-dev.20260618.1 |    |
  | vitest                                                                                            | devDependency | updated | ^4.1.8               | ^4.1.9               |    |

## 0.6.0

### Features

* [`2d7893a`](https://github.com/savvy-web/systems/commit/2d7893afbd2f82324f94a2a70eeeac2ee4b28b89) ### SEA compilation is now a step of every dev and prod build

A package that ships a single-executable (SEA) binary via `defineBuild({ exe })` no longer needs the standalone `--target exe` target to produce a usable artifact. A normal `--target dev`/`--target prod` build now emits the binary AND programs the manifest to point at its computed, platform-suffixed filename — the `exports`/`bin` entry resolves to the SEA and the binary is added to `files`. The exe entry source is excluded from the JS pass, so a pure-binary package emits no dead JS stub. The SEA is compiled last, into each built group's `pkg/bin`, so the dev `clean` cannot wipe it. The standalone `--target exe` target is retained as a manual escape hatch.

### `--no-exe` skips the SEA compile while still programming the manifest

`parseArgs` now recognizes `--no-exe`. A `--target dev --no-exe` build programs the manifest with the computed binary name but skips the cross-compile, so `prepare` and frozen-lockfile installs never cross-compile a SEA — important on Linux install steps where extracting a Windows SEA fails. The full `build:dev`/`build:prod` runs do the actual cross-compile.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.5.0 | 0.6.0 |

## 0.5.0

### Features

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) ### Per-override platform, CSS, and subdir partitions in `BuildEntryOverride`

`BuildEntryOverride` gains three new fields that mirror the `tsdown-plugins` capabilities:

* `platform` (`BuildPlatform`) — sets the JS-pass build platform for this partition. Defaults to `"node"`. Use `"browser"` for a web runtime.
* `css` (`CssOptions`) — forwarded to tsdown's `css` option (JS pass only). Enables CSS module support for a browser partition. The consuming package must install `@tsdown/css`.
* `outSubdir` (`string`) — builds the partition into `<group>/pkg/<outSubdir>/` as an isolated sub-package. The export's built path becomes `./<outSubdir>/index.{js,d.ts}`. Exactly one export path may be pinned per `outSubdir` override.

### Subdir meta inputs for API model generation

When an override sets `outSubdir`, `runBuild` now correctly points that export's API Extractor input at the isolated `<outSubdir>/index.d.ts` barrel rather than the flat `<name>.d.ts` path. This ensures a subdir export (for example a `./runtime` entry) contributes its declarations to the API model under `--target meta` and `--target prod`.

`subdirExports` is derived automatically from the `overrides` list and forwarded to `buildTargetGroups` — no manual configuration is required.

### TSConfig export moved under the `tsconfig/` namespace

The shared base config is now also exported as `@savvy-web/bundler/tsconfig/ecma.json`, aligning with the `tsconfig/` export convention used across the Silk build tooling. The existing `@savvy-web/bundler/ecma.json` export is retained as a deprecated alias (both point at the same file) and will be removed in the next major. Migrate `"extends"` references to `@savvy-web/bundler/tsconfig/ecma.json`.

The shared base also bumps `target` from `es2023` to `es2025`, reflecting the Node.js 24 baseline. Packages extending it now type-check against the ES2025 language level.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.4.2 | 0.5.0 |

## 0.4.2

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.4.1 | 0.4.2 |

## 0.4.1

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.4.0 | 0.4.1 |

## 0.4.0

### Features

* [`2675852`](https://github.com/savvy-web/systems/commit/26758526060024d616a059799c04cd7965b57360) A `looseFiles` option on `defineBuild` for emitting standalone, self-contained bundled files at literal output paths outside the exports, declaration, and API-model graph. Keys are literal output filenames; values are a source path or a source-plus-format object. Module format is inferred from a `.mjs` or `.cjs` key and required for an ambiguous `.js` key. Pair with `bundleNodeModules` to make each file fully self-contained. This supports building pnpm config dependencies, which forbid runtime dependencies and resolve their `pnpmfile.mjs`/`pnpmfile.cjs` by filename at the package root.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.3.0 | 0.4.0 |

## 0.3.0

### Features

* [`bffeffe`](https://github.com/savvy-web/systems/commit/bffeffee4f7d1b9decfbc040790650bfee2e7667) ### `define` option on `defineBuild`

Pass compile-time global replacements directly from `defineBuild`. The values are forwarded verbatim to the underlying tsdown/rolldown `define` — string literals must be pre-quoted:

```ts
import { defineBuild } from "@savvy-web/bundler";

export default defineBuild({
  define: {
    "process.env.FLAG": JSON.stringify("on"),
    "process.env.API_URL": JSON.stringify("https://api.example.com"),
  },
});
```

User-supplied keys are merged with the auto-injected `process.env.__PACKAGE_VERSION__` define; when a user key collides with the auto-version key, the user value wins.

### Bug Fixes

* [`bffeffe`](https://github.com/savvy-web/systems/commit/bffeffee4f7d1b9decfbc040790650bfee2e7667) The auto-injected package version define previously used the bare identifier `__PACKAGE_VERSION__` as its key. rolldown only replaces `define` keys when the source contains a literal token match, so a bare identifier key never matched the `process.env.__PACKAGE_VERSION__` member expression that packages actually read. The key is now `process.env.__PACKAGE_VERSION__`. Packages whose source reads `process.env.__PACKAGE_VERSION__` (including `@savvy-web/cli` and `@savvy-web/github-action-builder`) previously shipped with the version unreplaced and reported `0.0.0` at runtime; they now report the real version.

### `meta` is now optional — `savvy build --target meta` works without configuration

The `meta` option is now tri-state. Omit it (or leave it `undefined`) and api-model generation runs with default options: `savvy build --target meta` works out of the box and `savvy build --target prod` emits the meta release asset. Pass an object only to override defaults (`localPaths`, `tsdoc`). Pass `false` to opt out entirely — both targets become no-ops:

```ts
export default defineBuild({
  // omit meta entirely  -> generate with defaults
  // meta: { localPaths: ["../models"] }  -> override defaults
  meta: false, // -> skip api-model generation on both --target meta and --target prod
});
```

Previously an empty `meta: {}` object was required just to make `--target meta` runnable — omitting it threw `requires a 'meta' option`. That boilerplate is gone.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.2.1 | 0.3.0 |

## 0.2.1

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.2.0 | 0.2.1 |

## 0.2.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Initial `@savvy-web/bundler` program — the tsdown-based replacement for `@savvy-web/rslib-builder`

The `defineBuild`/`runBuild` orchestrator and self-executing `savvy.build.ts` contract driving tsdown over `@savvy-web/tsdown-plugins`:

* SP1 foundation; catalog/`workspace:` resolution delegated to `workspaces-effect`'s `CatalogResolver`; a `ConfigValidator` gate that fast-fails on bad config across dev/npm/meta/exe.
* Track A meta generation (`--target meta` API Extractor model into `localPaths`, npm `meta/` release asset), Track C multi-target publishing (`--target prod` derives byte-variant groups from the Record-map `publishConfig.targets` and writes the `dist/prod/targets.json` binding), Track B SEA exe compilation (`--target exe`), Track D tsconfig-inherited JSX.
* M1 dual esm+cjs format, M2 self-hosting, M3 bundled-dts two-pass build, M4-M6 bundling-posture controls (`bundleNodeModules`/`bundle`/`bundledPackages`/`dtsExternals`), per-entry `overrides`, fluent defaults (`defaultManifestTransform`, unminified prod), and the shipped `@savvy-web/bundler/ecma.json` TS base config.

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
* Strip prod `.d.ts.map`/`.d.cts.map` from published output.

### Self-hosting builds now emit the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), and `@savvy-web/bundler`'s own `publishConfig.targets` is the Record-map `{ npm: true, github: true }` — so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.1.0 | 0.2.0 |

## 0.1.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Initial `@savvy-web/bundler` program — the tsdown-based replacement for `@savvy-web/rslib-builder`

The `defineBuild`/`runBuild` orchestrator and self-executing `savvy.build.ts` contract driving tsdown over `@savvy-web/tsdown-plugins`:

* SP1 foundation; catalog/`workspace:` resolution delegated to `workspaces-effect`'s `CatalogResolver`; a `ConfigValidator` gate that fast-fails on bad config across dev/npm/meta/exe.
* Track A meta generation (`--target meta` API Extractor model into `localPaths`, npm `meta/` release asset), Track C multi-target publishing (`--target prod` derives byte-variant groups from the Record-map `publishConfig.targets` and writes the `dist/prod/targets.json` binding), Track B SEA exe compilation (`--target exe`), Track D tsconfig-inherited JSX.
* M1 dual esm+cjs format, M2 self-hosting, M3 bundled-dts two-pass build, M4-M6 bundling-posture controls (`bundleNodeModules`/`bundle`/`bundledPackages`/`dtsExternals`), per-entry `overrides`, fluent defaults (`defaultManifestTransform`, unminified prod), and the shipped `@savvy-web/bundler/ecma.json` TS base config.

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) CJS default-import interop for `node:` builtins (`nodeBuiltinDefaultInterop`).
* Strip prod `.d.ts.map`/`.d.cts.map` from published output.

### Self-hosting builds now emit the target binding

The escape-hatch `savvy.build.ts` now writes `dist/prod/targets.json` on `--target prod` (previously only the front-door `runBuild` did), and `@savvy-web/bundler`'s own `publishConfig.targets` is the Record-map `{ npm: true, github: true }` — so release tooling resolves it to the published `dist/prod/<group>/pkg` bytes.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.0.0 | 0.1.0 |
