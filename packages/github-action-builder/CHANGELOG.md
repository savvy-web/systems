# @savvy-web/github-action-builder

## 2.2.4

### Dependencies

* | Dependency     | Type       | Action  | From   | To     |                                                                       |
  | -------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/yaml | dependency | updated | ^0.7.0 | ^0.8.0 | [#467][#467] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#467]: https://github.com/savvy-web/systems/pull/467

## 2.2.3

### Dependencies

* | Dependency            | Type       | Action  | From           | To             |                                                                              |
  | --------------------- | ---------- | ------- | -------------- | -------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 |                                                                              |
  | @effected/yaml        | dependency | updated | ^0.6.1         | ^0.7.0         |                                                                              |
  | effect                | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 | [#449][#449] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#449]: https://github.com/savvy-web/systems/pull/449

## 2.2.2

### Dependencies

* | Dependency     | Type       | Action  | From   | To     |                                                                              |
  | -------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/yaml | dependency | updated | ^0.6.0 | ^0.6.1 | [#416][#416] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#416]: https://github.com/savvy-web/systems/pull/416

## 2.2.1

### Dependencies

* | Dependency    | Type       | Action  | From   | To     |                                                          |
  | ------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | @rsbuild/core | dependency | updated | ^2.1.8 | ^2.1.9 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.2.0

### Breaking Changes

* ### Layer statics replace `XLive` exports

  `ConfigServiceLive`, `ValidationServiceLive`, `BuildServiceLive`, and `PersistLocalServiceLive` are removed, along with the four standalone module files that defined them. Each service's production layer now lives as a `.layer` static on its own class. The package's higher-level `ConfigLayer`, `ValidationLayer`, `BuildLayer`, `PersistLocalLayer`, and `AppLayer` composites are unaffected — only the lower-level per-service layer names change for anyone consuming them directly.

  ```typescript
  // Before
  import { ConfigServiceLive } from "@savvy-web/github-action-builder";
  Effect.provide(ConfigServiceLive);

  // After
  import { ConfigService } from "@savvy-web/github-action-builder";
  Effect.provide(ConfigService.layer);
  ```

  This is a genuine breaking change to the package's export surface, released as a minor bump rather than a major: consumption of `@savvy-web/github-action-builder` is effectively in-house across the Silk Suite, so the migration cost is contained and immediate. [#408][#408]

### Documentation

* `docs/05-architecture.md` is corrected against `src/layers/app.ts` and `src/services/persist-local.ts`:

  * The "Combined application layer" and "Adding a new service" `AppLayer` examples were both missing `PersistLocalLayer`; the real definition merges four layers, not three.
  * `PersistLocalService` previously appeared only in the file-structure tree. Added a service section matching the depth of `ConfigService`/`ValidationService`/`BuildService`, plus its `PersistLocalError`/`ActionYmlPathError` entries in the error-categories list. [#408][#408]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#408]: https://github.com/savvy-web/systems/pull/408

## 2.1.1

### Features

* Resolve each package's own tsconfig for the declaration pass instead of synthesizing one that extends nothing, so declarations compile under the real effective compiler options rather than TypeScript defaults.

  Align rspress-builder's public options with the bundler's own names. dtsBundledPackages becomes bundledPackages, apiModel becomes meta, and dtsExternals plus bundleNodeModules are exposed at both the build-wide and per-bundle levels.

### Bug Fixes

* Removes the TsconfigResolver enum-conversion class, which nothing consumed, in favor of the tsconfig-json kit. Corrects a false doc comment on EntryOverride that implied an omitted option falls back to the base build's value, when in fact each partition builds from its own values only.

  @savvy-web/github-action-builder now resolves its own tsconfig for the declaration pass, so its emitted declarations reference Node's URL type from node:url instead of the DOM global URL.

  A package tsconfig that exists but cannot be resolved, whether from malformed JSON or an extends target that cannot be located, now fails the build with package context instead of silently falling back to synthesized defaults. Falling back emitted declarations compiled under the wrong options while still reporting success, because the generated declaration-pass config never references the broken source. A package with no tsconfig at all remains a supported case and still uses the defaults.

### Other

* Both the TsconfigResolver removal and the rspress-builder option renames are released as minor rather than major, a deliberate SemVer deviation, because nothing outside this suite consumes either surface yet. [#398][#398]

- The shipped tsconfig presets now carry an inline note about how TypeScript resolves extends. The types and lib compiler options replace the base list rather than merging with it, so overriding either one in a consumer tsconfig means re-listing every entry still needed, node included, or losing access to console, process and Buffer with no warning from the compiler.

  ecma.json in bundler and rspress-builder, plugin.json in rspress-builder, and action.json in github-action-builder each carry a top-level note key documenting this. The bundler README also gains a short section explaining the behavior and pointing at plugin.json as the working example, since it already re-lists node alongside react and react-dom. [#398][#398]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#398]: https://github.com/savvy-web/systems/pull/398

## 2.1.0

### Features

* ### Production mode pinned by default

  `build:prod` now always pins rsbuild's mode to `"production"`, regardless of `NODE_ENV`. Previously, a bare local `build:prod` run without `NODE_ENV` set silently emitted an unminified build roughly 7x the size of the minified one, since rsbuild's mode falls back to `"none"` and minification only applies in production mode. Builds are now consistently minified whether or not the caller sets `NODE_ENV`.

  If a workflow relied on the unminified fallback for local debugging, set `build.minify: false` explicitly to opt back out of minification.

### Bug Fixes

* ### License attribution no longer dropped under minification

  License notices are now folded inline into the bundle instead of relying on `legalComments: "inline"`, which silently dropped third-party attribution once real minification ran. There is no longer a possibility of a `*.LICENSE.txt` sidecar file going missing from a committed action — attribution is preserved directly in the bundle output. [#382][#382]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#382]: https://github.com/savvy-web/systems/pull/382

## 2.0.6

### Dependencies

* | Dependency     | Type       | Action  | From   | To     |                                                                              |
  | -------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/yaml | dependency | updated | ^0.5.1 | ^0.6.0 | [#375][#375] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#375]: https://github.com/savvy-web/systems/pull/375

## 2.0.5

### Dependencies

* | Dependency            | Type       | Action  | From          | To             |                                                                              |
  | --------------------- | ---------- | ------- | ------------- | -------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 |                                                                              |
  | @effected/yaml        | dependency | updated | ^0.5.0        | ^0.5.1         |                                                                              |
  | effect                | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 | [#364][#364] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#364]: https://github.com/savvy-web/systems/pull/364

## 2.0.4

### Dependencies

* | Dependency     | Type       | Action  | From   | To     |                                                                       |
  | -------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/yaml | dependency | updated | ^0.4.0 | ^0.5.0 | [#336][#336] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#336]: https://github.com/savvy-web/systems/pull/336

## 2.0.3

### Dependencies

* | Dependency            | Type       | Action  | From          | To            |                                                                              |
  | --------------------- | ---------- | ------- | ------------- | ------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 |                                                                              |
  | @effected/yaml        | dependency | updated | ^0.3.1        | ^0.4.0        |                                                                              |
  | effect                | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 | [#326][#326] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#326]: https://github.com/savvy-web/systems/pull/326

## 2.0.2

### Dependencies

* | Dependency    | Type       | Action  | From   | To     |                                                          |
  | ------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | @rsbuild/core | dependency | updated | ^2.1.5 | ^2.1.6 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.0.1

### Dependencies

* | Dependency     | Type       | Action  | From   | To     |                                                          |
  | -------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | @effected/yaml | dependency | updated | ^0.2.0 | ^0.3.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.0.0

### Breaking Changes

* The build tool targets `effect@4` and ports its CLI from the dead `@effect/cli` to the in-core `effect/unstable/cli`; the four services convert to class-based `Context.Service` with exported `*Shape` interfaces.

### Dependencies

* | Dependency            | Type       | Action  | From     | To             |                                                                       |
  | --------------------- | ---------- | ------- | -------- | -------------- | --------------------------------------------------------------------- |
  | @effect/cli           | dependency | removed | ^0.75.2  | —              |                                                                       |
  | @effect/cluster       | dependency | removed | ^0.59.0  | —              |                                                                       |
  | @effect/platform      | dependency | removed | ^0.96.2  | —              |                                                                       |
  | @effect/printer       | dependency | removed | ^0.49.0  | —              |                                                                       |
  | @effect/printer-ansi  | dependency | removed | ^0.49.0  | —              |                                                                       |
  | @effect/rpc           | dependency | removed | ^0.75.1  | —              |                                                                       |
  | @effect/sql           | dependency | removed | ^0.51.1  | —              |                                                                       |
  | @effect/typeclass     | dependency | removed | ^0.40.0  | —              |                                                                       |
  | yaml-effect           | dependency | removed | ^0.7.2   | —              |                                                                       |
  | @effect/platform-node | dependency | updated | ^0.107.0 | catalog:effect |                                                                       |
  | effect                | dependency | updated | ^3.21.4  | catalog:effect |                                                                       |
  | @effected/yaml        | dependency | added   | —        | ^0.2.0         | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Other

* YAML parsing adopts `@effected/yaml`; eight unused `@effect/*` pins are removed. [#312][#312]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 1.1.2

### Dependencies

* | Dependency                 | Type           | Action  | From                  | To     |                                                                       |
  | -------------------------- | -------------- | ------- | --------------------- | ------ | --------------------------------------------------------------------- |
  | @typescript/native-preview | peerDependency | removed | ^7.0.0-dev.20260612.1 | —      |                                                                       |
  | @rsbuild/core              | dependency     | updated | ^2.1.4                | ^2.1.5 |                                                                       |
  | typescript                 | peerDependency | updated | ^6.0.0                | ^7.0.0 | [#278][#278] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#278]: https://github.com/savvy-web/systems/pull/278

## 1.1.1

### Dependencies

* | Dependency  | Type       | Action  | From   | To     |                                                                       |
  | ----------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | yaml-effect | dependency | updated | ^0.7.0 | ^0.7.2 | [#232][#232] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#232]: https://github.com/savvy-web/systems/pull/232

## 1.1.0

### Features

* ### `build.nativeDynamicImports` option

  Adds `build.nativeDynamicImports?: string[]` (defaults to `[]`) to keep a listed package's fully dynamic `import(...)` calls as native `import()` at runtime instead of letting rspack compile them into a context module.

  rspack cannot statically analyze a dynamic `import(expr)` whose argument isn't a string literal — e.g. `@changesets/apply-release-plan`, which resolves a changelog module path at runtime and dynamically imports it. Instead of bundling the call, rspack emits an empty-context stub that throws `Cannot find module` at runtime even though the target file exists on disk, with a build-time "Critical dependency: the request of a dependency is an expression" warning as the tell.

  Listing a package's name in `build.nativeDynamicImports` routes its bundled source through a new rspack loader (shipped from `public/loaders/webpack-ignore-dynamic-imports.cjs`) that injects a `/* webpackIgnore: true */` comment into any dynamic `import(` call whose argument isn't a string literal or already commented. rspack respects that comment and leaves the call as a plain runtime `import()`, so the module resolves for real instead of hitting the context-module stub. [#218][#218]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#218]: https://github.com/savvy-web/systems/pull/218

## 1.0.3

### Dependencies

* | Dependency  | Type           | Action  | From    | To      |
  | ----------- | -------------- | ------- | ------- | ------- |
  | @types/node | peerDependency | updated | ^26.0.0 | ^26.1.0 |

## 1.0.2

### Dependencies

* [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) | Dependency | Type | Action | From | To |
  \| ----------- | ---------- | ------- | ------ | ------ |
  \| yaml-effect | dependency | updated | ^0.6.0 | ^0.7.0 |

## 1.0.1

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so the package picks up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds a `LICENSE` file and minor `tsconfig.json` corrections. No runtime behavior changes.

## 1.0.0

### Breaking Changes

* ### Stable 1.0.0

`@savvy-web/github-action-builder` graduates to 1.0.0. It is built on `@savvy-web/bundler` 1.0, whose `public/` assets are copied into the package with the `public/` segment dropped and substructure preserved — so the published `./tsconfig/action.json` export resolves to `./tsconfig/action.json` at the package root. The export key is unchanged, so consumers importing `@savvy-web/github-action-builder/tsconfig/action.json` need no changes. Dependency ranges were refreshed.

## 0.8.0

### Features

* [`ce970c8`](https://github.com/savvy-web/systems/commit/ce970c8cf390533aab259294c5be38629964ac23) ### Worker bundle entries (`entries.workers`)

Adds `entries.workers` to the action config schema — a `Record<string, string>` mapping a bundle name to a source path. Each entry is emitted as `dist/<name>.js` alongside the standard lifecycle bundles (`main`, `pre`, `post`). Useful for declaring extra non-lifecycle scripts (e.g. a Node.js worker, a helper invoked via `node dist/cleanup.js`) without touching the lifecycle entry points.

* `entries.workers` — optional `Record<string, string>` in both `ActionConfig.entries` and the individual environment config blocks
* `WorkerEntryMissing` — new `@public` tagged error raised when a declared worker source file cannot be found on disk
* `WorkerEntryMissingBase` — exported base class for `WorkerEntryMissing` (follows the existing `*Base` pattern for tagged errors)
* `WorkerEntryInvalidName` (+ `WorkerEntryInvalidNameBase`) — new `@public` tagged error raised when a worker name is reserved (`main`/`pre`/`post`) or contains path separators, since the name is used directly as the `dist/<name>.js` output path; this prevents a worker from silently overwriting a lifecycle bundle or writing outside `dist/`

## 0.7.12

### Documentation

* [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) Added `@public` release tags across the public surface of all three packages so every exported symbol registers in the generated API model and passes the `ae-missing-release-tag` check. In `github-action-builder`, promoted the `Data.TaggedError` base classes and the `Schema`-derived type sources to `@public` to clear `ae-incompatible-release-tags`. Fixed TSDoc link warnings: unresolvable `{@link}` references (Effect `Context.Tag` service methods, which live in the tag's type argument rather than as class members, plus external symbols) were replaced with backtick code spans, ambiguous references were given member-reference selectors, and the stale `PublishabilityDetector` reference was retargeted to `SilkPublishability`. Removed stray `@packageDocumentation` tags from non-entry modules so only each package entry carries one.

This is a documentation-surface change only — every retagged symbol was already exported, and the build performs no `@internal` trimming, so the shipped type declarations are unchanged.

### Dependencies

* | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency    | Type    | Action                | From                  | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :-------------------- | :-------------------- | -- |
  | @effect/platform                                                                                  | dependency    | updated | ^0.96.1               | ^0.96.2               |    |
  | effect                                                                                            | dependency    | updated | ^3.21.3               | ^3.21.4               |    |
  | @typescript/native-preview                                                                        | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |    |
  | @types/node                                                                                       | devDependency | updated | ^25.9.0               | ^26.0.0               |    |

## 0.7.11

### Dependencies

* | [`c0ae4b9`](https://github.com/savvy-web/systems/commit/c0ae4b95ef2a581445c51b3a78e17590be612951) | Dependency    | Type    | Action               | From                 | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :------------------- | :------------------- | -- |
  | @rsbuild/core                                                                                     | dependency    | updated | ^2.0.12              | ^2.0.15              |    |
  | @typescript/native-preview                                                                        | devDependency | updated | 7.0.0-dev.20260614.1 | 7.0.0-dev.20260618.1 |    |
  | vitest                                                                                            | devDependency | updated | ^4.1.8               | ^4.1.9               |    |

## 0.7.10

### Bug Fixes

* [`e336b15`](https://github.com/savvy-web/systems/commit/e336b158adf766d9a74777000906308fdf53e9d4) Bundled actions no longer crash on Windows runners. rspack's default
  `import.meta` parsing froze each module's `import.meta.url` to its absolute
  build-machine source path as a `file://` literal during scope hoisting.
  Dependencies that synthesize `require` / `__filename` from `import.meta.url` at
  module top-level — such as `@azure/storage-common`'s crc64 ESM-compat shim
  (reached via `@azure/storage-blob`) — then handed that frozen POSIX path to
  `createRequire`. A driveless POSIX `file://` URL is structurally valid on
  macOS/Linux but rejected by `createRequire` on Windows, throwing at module load
  before any in-library fallback could run.

The bundler now disables rspack's `import.meta` parse
(`module.parser.javascript.importMeta: false`), leaving `import.meta.url` as a
runtime expression that resolves to the emitted ESM bundle's own URL on every
platform.

## 0.7.9

### Bug Fixes

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### Missing `@effect/*` peers no longer crash at load (#126)

`@savvy-web/github-action-builder` now declares `@effect/cluster`, `@effect/rpc`, and `@effect/sql` as direct dependencies (via `catalog:silk`). The `@effect/platform-node` root barrel eagerly links these clustering submodules, so without this declaration an install tree that did not already provide them would fail with `ERR_MODULE_NOT_FOUND` at startup.

## 0.7.8

### Dependencies

* | [`2b264af`](https://github.com/savvy-web/systems/commit/2b264af80a44e7bed50f6dcc9daf61c356550b29) | Dependency | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :------ | :------ | -- |
  | @rsbuild/core                                                                                     | dependency | updated | ^2.0.11 | ^2.0.12 |    |

## 0.7.7

### Dependencies

* | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type    | Action | From    | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :------ | -- |
  | @rsbuild/core                                                                                     | dependency | updated | ^2.0.9 | ^2.0.11 |    |

## 0.7.6

### Bug Fixes

* [`75c0a42`](https://github.com/savvy-web/systems/commit/75c0a429f5a053609ee5bbe8f3fe54392edff82c) Bump to force missing release.

## 0.7.5

### Build System

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`.

## 0.7.4

### Other

* [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments

## 0.7.3

### Other

* [`d7bcbf9`](https://github.com/savvy-web/systems/commit/d7bcbf9b2329dfd86d61fb4bb619e0b3558a71a2) The package source has moved into the `savvy-web/systems` monorepo. It is no longer maintained in its former standalone repository.

- The published package, its public API, its exports, and its npm package name are all unchanged — no action required on upgrade.
- Package metadata (`repository`, `homepage`, `bugs`) now points at `savvy-web/systems`.

> Migrated from `savvy-web/github-action-builder@ab5ddf5` on 2026-05-30. Earlier release history lives in the original source repository.

## 0.7.2

### Bug Fixes

* [`3a389c9`](https://github.com/savvy-web/github-action-builder/commit/3a389c9b636922a3c5f10021fddfc297beb10b68) Action builds are now reproducible. When `build.ignore` was set, the ignore stub was written to a random `mkdtemp` directory whose absolute path rspack embedded in the bundle as a module id, so building the same source twice produced byte-different output and noisy diffs in committed action code. The stub now lives at a deterministic path under `node_modules/.cache`, so repeated builds are byte-identical.
* Bundled third-party license banners are kept inline instead of being extracted to `*.LICENSE.txt` sidecar files, removing the extra committed file from action output while preserving license attribution.

## 0.7.1

### Bug Fixes

* [`9814a9e`](https://github.com/savvy-web/github-action-builder/commit/9814a9eb094e55143fb4079d1ffb021f36c3ae05) Fix `__dirname` and `__filename` being undefined in ESM action bundles by injecting CJS compatibility shims, and ensure each action entry produces a single predictable output file by disabling async chunks.

## 0.7.0

### Features

* [`aa802d6`](https://github.com/savvy-web/github-action-builder/commit/aa802d6eb34544a38a5753238fb1f954109aa8c8) Added `build.ignore` — a `string[]` option listing modules to exclude from the bundle and replace with a throwing stub. Use it for optional transitive dependencies the action never exercises (for example, native modules pulled in as optional plugins by a dependency). Unlike `build.externals` (packages excluded because they are available at runtime), `build.ignore` packages are absent at runtime; code that wraps their `require()` calls in `try/catch` correctly detects them as unavailable.

### Bug Fixes

* [`aa802d6`](https://github.com/savvy-web/github-action-builder/commit/aa802d6eb34544a38a5753238fb1f954109aa8c8) Fixed user-configured `build.externals` entries not being honored after the v0.6.4 `node:` interop fix. A change to the rspack externals config structure had caused the trailing string entries to be silently ignored, so configured package names were bundled and hard-failed to resolve instead of being externalized.

## 0.6.4

### Bug Fixes

* [`c594590`](https://github.com/savvy-web/github-action-builder/commit/c594590db1d66d404d1b8f4b47ced60abbf4b3d1) Fixed a runtime crash when bundling CommonJS dependencies that use TypeScript's `__importDefault(require("node:*"))` interop helper. The builder previously externalized `node:` builtins as ESM namespace imports in ESM-output mode, causing downstream `instanceof` checks to throw `TypeError: Right-hand side of 'instanceof' is not callable`. The fix externalizes `node:` builtins with `node-commonjs` type so bundled CJS deps receive real CommonJS `require()` semantics. A regression integration test is included.

## 0.6.3

### Dependencies

* | [`ab0c9cc`](https://github.com/savvy-web/github-action-builder/commit/ab0c9cc7fa2c06eae13dc566a28210f8fd641a18) | Dependency    | Type    | Action  | From    | To |
  | :-------------------------------------------------------------------------------------------------------------- | :------------ | :------ | :------ | :------ | -- |
  | @savvy-web/changesets                                                                                           | devDependency | updated | ^0.7.4  | ^0.8.0  |    |
  | @savvy-web/commitlint                                                                                           | devDependency | updated | ^0.5.2  | ^0.6.0  |    |
  | @savvy-web/lint-staged                                                                                          | devDependency | updated | ^0.7.3  | ^0.8.0  |    |
  | @savvy-web/rslib-builder                                                                                        | devDependency | updated | ^0.20.0 | ^0.20.1 |    |
  | @savvy-web/vitest                                                                                               | devDependency | updated | ^1.2.2  | ^1.3.0  |    |

## 0.6.2

### Bug Fixes

* [`9263759`](https://github.com/savvy-web/github-action-builder/commit/92637598ca6f3d062c105cc8f379697e0612ad7d) Added explicit `"types": ["node"]` to the exported `tsconfig/action.json` so that `tsgo` correctly resolves `@types/node` in pnpm's symlinked `node_modules`.

## 0.6.1

### Dependencies

* | [`6742fa2`](https://github.com/savvy-web/github-action-builder/commit/6742fa2ac673b0a40103575784d123eb42edc037) | Dependency    | Type    | Action | From   | To |
  | :-------------------------------------------------------------------------------------------------------------- | :------------ | :------ | :----- | :----- | -- |
  | @savvy-web/lint-staged                                                                                          | devDependency | updated | ^0.6.3 | ^0.6.4 |    |

- | [`d206b06`](https://github.com/savvy-web/github-action-builder/commit/d206b064efb0ea7b63c94c2dd892ed976e40cdc5) | Dependency    | Type    | Action | From   | To |
  | :-------------------------------------------------------------------------------------------------------------- | :------------ | :------ | :----- | :----- | -- |
  | @savvy-web/changesets                                                                                           | devDependency | updated | ^0.6.0 | ^0.7.0 |    |
  | @savvy-web/commitlint                                                                                           | devDependency | updated | ^0.4.2 | ^0.4.3 |    |
  | @savvy-web/lint-staged                                                                                          | devDependency | updated | ^0.6.1 | ^0.6.3 |    |
  | @savvy-web/vitest                                                                                               | devDependency | updated | ^1.0.0 | ^1.0.1 |    |

## 0.6.0

### Features

* [`f472d58`](https://github.com/savvy-web/github-action-builder/commit/f472d583bc3ee268a8e006b1bb64d3104bb58056) Added a shared `tsconfig.json` for GitHub Action consumer projects, exported at `@savvy-web/github-action-builder/tsconfig/action.json`. The config provides ES2022 target, strict mode, bundler module resolution, and standard include patterns for action source trees.

### Bug Fixes

* [`f472d58`](https://github.com/savvy-web/github-action-builder/commit/f472d583bc3ee268a8e006b1bb64d3104bb58056) Fixed `TypeError: Unknown file extension ".ts"` when loading `action.config.ts` in CI environments. Native `import()` cannot load TypeScript files without a registered loader. Config files with a `.ts` extension are now loaded via `jiti`; `.js` and `.mjs` configs continue to use native import.

## 0.5.1

### Features

* [`aeb5218`](https://github.com/savvy-web/github-action-builder/commit/aeb521873e712fa4826643fb3896c3d8ec06f9de) Upgrades to new `@savvy-web/vitest` standard setup

## 0.5.0

### Breaking Changes

* [`f0710f9`](https://github.com/savvy-web/github-action-builder/commit/f0710f9f5e1fb178ccd565e42e3444a04f3a7291) `BuildOptions.target` and `BuildOptions.quiet` config fields removed.
  Target is now hardcoded to ES2024 (Node 24). The `EsTarget` type export is removed.

### Features

* [`f0710f9`](https://github.com/savvy-web/github-action-builder/commit/f0710f9f5e1fb178ccd565e42e3444a04f3a7291) Replace `@vercel/ncc` with `@rsbuild/core` for GitHub Action bundling.

- Produces clean ESM output without `eval("require")` hacks that broke Node 24
- Supports tree-shaking via rspack
- Single-file output per entry point with `all-in-one` chunk strategy
- `node:*` builtins always externalized automatically

### Other

* [`f0710f9`](https://github.com/savvy-web/github-action-builder/commit/f0710f9f5e1fb178ccd565e42e3444a04f3a7291) Fixes #43

## 0.4.0

### Features

* [`cf95494`](https://github.com/savvy-web/github-action-builder/commit/cf954940cbb7889afad8c790a7cc237552923b37) Migrate Effect dependencies to catalog:silk and replace yaml with yaml-effect for Effect-native YAML parsing. Closes #37.

### Dependencies

* | [`4320227`](https://github.com/savvy-web/github-action-builder/commit/43202276c726ab55988280d44412b30d6658c75f) | Dependency | Type    | Action  | From    | To |
  | :-------------------------------------------------------------------------------------------------------------- | :--------- | :------ | :------ | :------ | -- |
  | @savvy-web/changesets                                                                                           | dependency | updated | ^0.4.1  | ^0.5.3  |    |
  | @savvy-web/commitlint                                                                                           | dependency | updated | ^0.4.0  | ^0.4.2  |    |
  | @savvy-web/lint-staged                                                                                          | dependency | updated | ^0.5.0  | ^0.6.1  |    |
  | @savvy-web/rslib-builder                                                                                        | dependency | updated | ^0.16.0 | ^0.18.2 |    |
  | @savvy-web/vitest                                                                                               | dependency | updated | ^0.2.0  | ^0.2.1  |    |

## 0.3.0

### Features

* [`5820156`](https://github.com/savvy-web/github-action-builder/commit/58201563df086a3deaaf3640e01fe4cc2c632b97) ### Preserve error stack traces with Effect Cause integration

Widen cause field from string to unknown on 5 error classes
(ConfigLoadFailed, BundleFailed, WriteError, CleanError,
PersistLocalError) to preserve original Error objects with stack traces.

Service layers now pass raw errors instead of extracting .message.
CLI renders full error chains via Effect.sandbox + Cause.pretty.
Programmatic API exposes cause field on GitHubActionBuildResult.

## 0.2.1

### Dependencies

* [`d9d434e`](https://github.com/savvy-web/github-action-builder/commit/d9d434eaa1d104d02b3dfe517138463efceb8219) @savvy-web/changesets: ^0.3.0 → ^0.4.1
* @savvy-web/commitlint: ^0.3.4 → ^0.4.0
* @savvy-web/lint-staged: ^0.4.6 → ^0.5.0
* @savvy-web/rslib-builder: ^0.15.0 → ^0.16.0
* @savvy-web/vitest: ^0.1.0 → ^0.2.0

## 0.2.0

### Features

* [`c9947b0`](https://github.com/savvy-web/github-action-builder/commit/c9947b08e7c3559b1cfc150dda3c0af995dabafa) Add `persistLocal` feature to automatically copy build output to `.github/actions/local/` for local testing with nektos/act
* Smart sync with hash-based comparison, stale file cleanup, and action.yml path validation
* Act template generation (`.actrc`, `act-test.yml`) for quick setup
* New `--no-persist` CLI flag to skip persist step

## 0.1.4

### Bug Fixes

* [`fcaa948`](https://github.com/savvy-web/github-action-builder/commit/fcaa948da09dc3bebc02b636bdb2b6398dded0a7) Supports @savvy-web/vitest
* Fixes circular dependencies issue

## 0.1.3

### Patch Changes

* e410c8a: Update dependencies:

  **Dependencies:**

  * @savvy-web/rslib-builder: ^0.12.2 → ^0.14.1

* 2af2b96: ## Features
  * Support for @savvy-web/changesets

* 289f0a6: Update dependencies:

  **Dependencies:**

  * @savvy-web/commitlint: ^0.3.1 → ^0.3.2
  * @savvy-web/lint-staged: ^0.3.2 → ^0.4.0
  * @savvy-web/rslib-builder: ^0.12.1 → ^0.12.2

## 0.1.2

### Patch Changes

* 6e927d4: Update dependencies:

  **Dependencies:**

  * @savvy-web/commitlint: ^0.3.0 → ^0.3.1
  * @savvy-web/lint-staged: ^0.3.1 → ^0.3.2
  * @savvy-web/rslib-builder: ^0.12.0 → ^0.12.1

* e9784b1: Specifies TypeScript and Node.js types as peer dependencies for easy installation

## 0.1.1

### Patch Changes

* 870addd: Standardizes dependencies with @savvy-web/pnpm-plugin-silk

## 0.1.0

### Minor Changes

* 416dafb: Initial release of @savvy-web/github-action-builder - a zero-config build tool
  for creating GitHub Actions from TypeScript source code.

  ## Features

  ### Zero-Config Project Scaffolding

  Create a complete GitHub Action project with a single command:

  ```bash
  npx @savvy-web/github-action-builder init my-action
  ```

  Generates a ready-to-build project with:

  * `package.json` with build scripts and dependencies
  * `tsconfig.json` configured for Node.js 24 ESM
  * `action.yml` with GitHub Action metadata
  * `action.config.ts` build configuration
  * `src/main.ts`, `src/pre.ts`, `src/post.ts` entry points

  ### Modern Node.js 24 Actions

  Build ESM-native GitHub Actions for the latest runtime:

  * Targets Node.js 24 with ES2022+ features
  * Validates `action.yml` requires `runs.using: "node24"`
  * Outputs flat bundle structure: `dist/main.js`, `dist/pre.js`, `dist/post.js`

  ### Single-File Bundles with @vercel/ncc

  All dependencies inlined into self-contained bundles:

  * No `node_modules` required at runtime
  * Minified by default for smaller bundles
  * Supports external packages for native modules

  ### GitHub Action Schema Validation

  Validates `action.yml` against GitHub's official metadata specification:

  * Checks required fields (name, description, runs)
  * Validates inputs, outputs, and branding configuration
  * Ensures `runs.using` is set to `node24`

  ### CI-Aware Strict Mode

  Automatically adapts validation behavior:

  * **Local development**: Warnings shown, build continues
  * **CI environments**: Warnings become errors, build fails

  ### Programmatic API

  Use the builder in scripts with full TypeScript support:

  ```typescript
  import { GitHubAction } from "@savvy-web/github-action-builder";

  const action = GitHubAction.create({
    build: { minify: true },
  });

  const result = await action.build();
  ```

  ### CLI Commands

  * `init <action-name>` - Create a new GitHub Action project
  * `build` - Bundle entry points into production-ready JavaScript
  * `validate` - Check configuration and action.yml without building
