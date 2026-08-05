# @savvy-web/tsdown-plugins

## 2.4.4

### Dependencies

* | Dependency           | Type       | Action  | From   | To      |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------- | --------------------------------------------------------------------- |
  | @effected/npm        | dependency | updated | ^0.8.2 | ^0.8.3  |                                                                       |
  | @effected/workspaces | dependency | updated | ^0.9.5 | ^0.10.0 | [#429][#429] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#429]: https://github.com/savvy-web/systems/pull/429

## 2.4.3

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                              |
  | ---------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/npm          | dependency | updated | ^0.8.1 | ^0.8.2 |                                                                              |
  | @effected/package-json | dependency | updated | ^0.7.2 | ^0.7.3 |                                                                              |
  | @effected/workspaces   | dependency | updated | ^0.9.4 | ^0.9.5 | [#427][#427] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#427]: https://github.com/savvy-web/systems/pull/427

## 2.4.2

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/npm           | dependency | updated | ^0.8.0 | ^0.8.1 |                                                                              |
  | @effected/package-json  | dependency | updated | ^0.7.1 | ^0.7.2 |                                                                              |
  | @effected/tsconfig-json | dependency | updated | ^0.4.0 | ^0.4.1 |                                                                              |
  | @effected/workspaces    | dependency | updated | ^0.9.3 | ^0.9.4 | [#416][#416] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#416]: https://github.com/savvy-web/systems/pull/416

## 2.4.1

### Dependencies

* | Dependency                   | Type       | Action  | From          | To            |                                                          |
  | ---------------------------- | ---------- | ------- | ------------- | ------------- | -------------------------------------------------------- |
  | @changesets/get-release-plan | dependency | updated | ^5.0.0-next.7 | ^5.0.0-next.9 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.4.0

### Breaking Changes

* ### Layer statics replace `XLive` exports

  `ConfigValidatorLive`, `EnvironmentDetectorLive`, `ExecutorResolverLive`, `FormatSelectorLive`, and `OutputRendererLive` are removed. Each now lives as a `.layer` static on its own service class, and the five standalone module files that defined them are deleted.

  ```typescript
  // Before
  import { ConfigValidatorLive } from "@savvy-web/tsdown-plugins";
  Effect.provide(ConfigValidatorLive);

  // After
  import { ConfigValidator } from "@savvy-web/tsdown-plugins";
  Effect.provide(ConfigValidator.layer);
  ```

  `ReportPipelineLive` is renamed to `ReportPipeline` — it composes multiple services via `Layer.mergeAll` rather than belonging to one, so it has no owning class to attach a static to.

  ```typescript
  // Before
  import { ReportPipelineLive, renderReport } from "@savvy-web/tsdown-plugins";
  renderReport(reports, options).pipe(Effect.provide(ReportPipelineLive));

  // After
  import { ReportPipeline, renderReport } from "@savvy-web/tsdown-plugins";
  renderReport(reports, options).pipe(Effect.provide(ReportPipeline));
  ```

  This is a genuine breaking change to the package's export surface, released as a minor bump rather than a major: consumption of `@savvy-web/tsdown-plugins` is effectively in-house across the Silk Suite, so the migration cost is contained and immediate.

### Tests

* The ci-annotations report pipeline test previously used a fixture with no diagnostics, so the formatter's empty-array output satisfied the assertion's first disjunct unconditionally — the CI-annotation rendering path was never actually exercised. The fixture now carries a warning and an error, and the assertion checks the rendered `::warning`/`::error` annotation content directly. [#408][#408]

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                              |
  | ---------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/npm          | dependency | updated | ^0.6.0 | ^0.8.0 |                                                                              |
  | @effected/package-json | dependency | updated | ^0.6.1 | ^0.7.1 |                                                                              |
  | @effected/workspaces   | dependency | updated | ^0.9.1 | ^0.9.3 | [#400][#400] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#400]: https://github.com/savvy-web/systems/pull/400

[#408]: https://github.com/savvy-web/systems/pull/408

## 2.3.0

### Features

* Resolve each package's own tsconfig for the declaration pass instead of synthesizing one that extends nothing, so declarations compile under the real effective compiler options rather than TypeScript defaults.

  Align rspress-builder's public options with the bundler's own names. dtsBundledPackages becomes bundledPackages, apiModel becomes meta, and dtsExternals plus bundleNodeModules are exposed at both the build-wide and per-bundle levels.

- The portable tsconfig resolver now gets `types` from `@effected/tsconfig-json@0.4.0`'s new `includeTypes` opt-in on `PortableTsconfig.make`, instead of a local merge-back step that re-added `types` after the kit's allow-list filter dropped it. The resolver bumps to `^0.4.0` and passes `{ includeTypes: true }` into `make`, and the destructure-and-reassign workaround is gone.

  The emitted meta tsconfig carries the same keys and values as before, still `types: ["node"]` with `typeRoots` dropped. The only observed change is that `types` now sits in the position the kit's own allow-list places it rather than being appended last by the old mutation, so the JSON key order shifted; no consumer of this JSON reads it positionally. [#398][#398]

### Bug Fixes

* Ambient `.d.ts` export copying now happens inside `buildTargetGroups`, alongside the existing `copyPublicDir` call, instead of only in the bundler's `runBuild`. A self-hosting package that declares an ambient export and builds through the escape-hatch `savvy.build.ts` (which calls `buildTargetGroups` directly and never reaches `runBuild`) previously got its manifest rewritten to point at the ambient file without the file ever being copied, producing a broken published export. Every build path now copies it.

  As a result, `RunOptions.copyAmbientDts` is removed from `@savvy-web/bundler`. Nothing outside this suite consumed the injectable, so the removal ships as minor rather than major, consistent with the rest of this branch. `runBuild` still runs the early `extractAmbientDts`/`assertNoEntryCollisions` fast-fail validation before any build branch; only the copy step moved. [#398][#398]

- The meta tsconfig shipped at dist/prod/npm/meta/tsconfig.json now carries the resolved `types` array. The kit's PortableTsconfig allow-list classifies `types` as path-dependent and drops it, but it holds `@types/*` package names, not filesystem paths, and it is the only signal telling a downstream virtual TypeScript environment which ambient type packages to load. Without it, consumers building virtual environments got no `@types/node`, so `console`, `process` and `Buffer` were all missing. `types` is now merged back in from the resolved compiler options whenever the source config declares it; `typeRoots` stays dropped since those are genuinely absolute, machine-specific paths. [#398][#398]

* Removes the TsconfigResolver enum-conversion class, which nothing consumed, in favor of the tsconfig-json kit. Corrects a false doc comment on EntryOverride that implied an omitted option falls back to the base build's value, when in fact each partition builds from its own values only.

  @savvy-web/github-action-builder now resolves its own tsconfig for the declaration pass, so its emitted declarations reference Node's URL type from node:url instead of the DOM global URL.

  A package tsconfig that exists but cannot be resolved, whether from malformed JSON or an extends target that cannot be located, now fails the build with package context instead of silently falling back to synthesized defaults. Falling back emitted declarations compiled under the wrong options while still reporting success, because the generated declaration-pass config never references the broken source. A package with no tsconfig at all remains a supported case and still uses the defaults.

- Guard against missing version endpoints on changesets releases typed as none. The changesets types package only guarantees oldVersion and newVersion on the major, minor and patch arms of ComprehensiveRelease, so an entry typed none may carry neither.

  The dependency changelog table now drops entries missing either endpoint rather than rendering an empty From or To cell. Maintenance-reason derivation no longer names a none co-member as a release trigger, which printed an unchanged version as the cause of the release. Next-version resolution skips releases with no newVersion instead of overwriting the seeded current version with undefined. [#398][#398]

### Other

* The portable tsconfig resolver now gets `types` from `@effected/tsconfig-json@0.4.0`'s new `includeTypes` opt-in on `PortableTsconfig.make`, instead of a local merge-back step that re-added `types` after the kit's allow-list filter dropped it. The resolver bumps to `^0.4.0` and passes `{ includeTypes: true }` into `make`, and the destructure-and-reassign workaround is gone.

  The emitted meta tsconfig carries the same keys and values as before, still `types: ["node"]` with `typeRoots` dropped. The only observed change is that `types` now sits in the position the kit's own allow-list places it rather than being appended last by the old mutation, so the JSON key order shifted; no consumer of this JSON reads it positionally. [#398][#398]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#398]: https://github.com/savvy-web/systems/pull/398

## 2.2.3

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                              |
  | ---------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/npm          | dependency | updated | ^0.5.0 | ^0.6.0 |                                                                              |
  | @effected/package-json | dependency | updated | ^0.6.0 | ^0.6.1 |                                                                              |
  | @effected/workspaces   | dependency | updated | ^0.9.0 | ^0.9.1 | [#396][#396] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#396]: https://github.com/savvy-web/systems/pull/396

## 2.2.2

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/tsconfig-json | dependency | updated | ^0.3.2 | ^0.3.3 | [#385][#385] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#385]: https://github.com/savvy-web/systems/pull/385

## 2.2.1

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                       |
  | ---------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/npm          | dependency | updated | ^0.4.0 | ^0.5.0 |                                                                       |
  | @effected/package-json | dependency | updated | ^0.5.2 | ^0.6.0 |                                                                       |
  | @effected/workspaces   | dependency | updated | ^0.8.0 | ^0.9.0 | [#382][#382] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#382]: https://github.com/savvy-web/systems/pull/382

## 2.2.0

### Features

* The build issues artifact (`dist/<target>/issues.json`) now stamps `buildOk: boolean`, plus an optional `failure: { name?, message }` when the build ended in a terminal error. The artifact is written on every terminal path — success and failure — so a crashed build (a blown-up API Extractor pass, a racing `rm -rf dist`) no longer reads as a clean gate with every diagnostic bucket simply empty; readers must gate on `buildOk`, not `errors.length`.
* The artifact write is now atomic: the JSON lands in a sibling temp file that is renamed over the destination, so a concurrent reader never observes a torn or half-written file. [#373][#373]

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/npm           | dependency | updated | ^0.3.1 | ^0.4.0 |                                                                              |
  | @effected/package-json  | dependency | updated | ^0.5.1 | ^0.5.2 |                                                                              |
  | @effected/tsconfig-json | dependency | updated | ^0.3.1 | ^0.3.2 |                                                                              |
  | @effected/workspaces    | dependency | updated | ^0.7.0 | ^0.8.0 | [#375][#375] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#373]: https://github.com/savvy-web/systems/pull/373

[#375]: https://github.com/savvy-web/systems/pull/375

## 2.1.9

### Dependencies

* | Dependency           | Type       | Action  | From   | To     |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.6.2 | ^0.7.0 | [#369][#369] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#369]: https://github.com/savvy-web/systems/pull/369

## 2.1.8

### Dependencies

* | Dependency              | Type       | Action  | From          | To             |                                                                              |
  | ----------------------- | ---------- | ------- | ------------- | -------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node   | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 |                                                                              |
  | @effected/npm           | dependency | updated | ^0.3.0        | ^0.3.1         |                                                                              |
  | @effected/package-json  | dependency | updated | ^0.5.0        | ^0.5.1         |                                                                              |
  | @effected/tsconfig-json | dependency | updated | ^0.3.0        | ^0.3.1         |                                                                              |
  | @effected/workspaces    | dependency | updated | ^0.6.1        | ^0.6.2         |                                                                              |
  | effect                  | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 | [#364][#364] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#364]: https://github.com/savvy-web/systems/pull/364

## 2.1.7

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                              |
  | ---------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/package-json | dependency | updated | ^0.4.2 | ^0.5.0 |                                                                              |
  | @effected/workspaces   | dependency | updated | ^0.6.0 | ^0.6.1 | [#351][#351] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#351]: https://github.com/savvy-web/systems/pull/351

## 2.1.6

### Dependencies

* | Dependency               | Type       | Action  | From     | To       |                                                                              |
  | ------------------------ | ---------- | ------- | -------- | -------- | ---------------------------------------------------------------------------- |
  | @microsoft/api-extractor | dependency | updated | ^7.58.11 | ^7.58.12 | [#349][#349] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#349]: https://github.com/savvy-web/systems/pull/349

## 2.1.5

### Dependencies

* | Dependency              | Type       | Action  | From    | To       |                                                                       |
  | ----------------------- | ---------- | ------- | ------- | -------- | --------------------------------------------------------------------- |
  | @effected/npm           | dependency | updated | ^0.2.3  | ^0.3.0   |                                                                       |
  | @effected/package-json  | dependency | updated | ^0.4.1  | ^0.4.2   |                                                                       |
  | @effected/tsconfig-json | dependency | updated | ^0.2.7  | ^0.3.0   |                                                                       |
  | @effected/workspaces    | dependency | updated | ^0.5.2  | ^0.6.0   |                                                                       |
  | tsdown                  | dependency | updated | ^0.22.9 | ^0.22.12 | [#342][#342] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#342]: https://github.com/savvy-web/systems/pull/342

## 2.1.4

### Refactoring

* Replaced `sort-package-json` with `@effected/package-json`'s `PackageJsonFormat.sortValue` in manifest transformation (byte-identical output) [#336][#336]

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                       |
  | ----------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | sort-package-json       | dependency | removed | ^4.0.0 | —      |                                                                       |
  | @effected/npm           | dependency | updated | ^0.2.1 | ^0.2.3 |                                                                       |
  | @effected/tsconfig-json | dependency | updated | ^0.2.4 | ^0.2.7 |                                                                       |
  | @effected/workspaces    | dependency | updated | ^0.4.1 | ^0.5.2 |                                                                       |
  | @effected/package-json  | dependency | added   | —      | ^0.4.1 | [#336][#336] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#336]: https://github.com/savvy-web/systems/pull/336

## 2.1.3

### Dependencies

* | Dependency              | Type       | Action  | From          | To            |                                                                              |
  | ----------------------- | ---------- | ------- | ------------- | ------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node   | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 |                                                                              |
  | @effected/npm           | dependency | updated | ^0.2.0        | ^0.2.1        |                                                                              |
  | @effected/tsconfig-json | dependency | updated | ^0.2.3        | ^0.2.4        |                                                                              |
  | @effected/workspaces    | dependency | updated | ^0.4.0        | ^0.4.1        |                                                                              |
  | effect                  | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 | [#326][#326] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#326]: https://github.com/savvy-web/systems/pull/326

## 2.1.2

### Dependencies

* | Dependency | Type       | Action  | From    | To      |                                                          |
  | ---------- | ---------- | ------- | ------- | ------- | -------------------------------------------------------- |
  | tsdown     | dependency | updated | ^0.22.7 | ^0.22.9 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.1.1

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                          |
  | ----------------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | @effected/tsconfig-json | dependency | updated | ^0.2.0 | ^0.2.2 |                                                          |
  | @effected/workspaces    | dependency | updated | ^0.3.0 | ^0.3.1 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.1.0

### Features

* Emit a trailing `default` exports condition mirroring the `import` target on every generated TypeScript export, so `require(esm)` resolves the ESM artifact on every supported Node runtime instead of failing with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Dual-format entries keep their dedicated CJS artifact under `require`, which wins by condition order. [#312][#312]

### Dependencies

* | Dependency           | Type       | Action  | From   | To     |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.2.0 | ^0.3.0 | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 2.0.0

### Breaking Changes

* ### Effect v4

  The package's entire Effect surface moves from v3 to v4 (`effect@4.0.0-beta.98`). Every exported service tag (`ConfigValidator`, `EnvironmentDetector`, `ExecutorResolver`, `FormatSelector`, `OutputRenderer`, `BuildCollectorTag`), layer, `Effect`, `Schema` class, and tagged error is now a v4 value — v3 consumers cannot compose them into an existing v3 Effect program. `Schema.Class` instances also now validate on construction, so passing an explicit `undefined` for an optional field throws where v3 silently accepted it.

  Consumers on `catalog:silk` (Effect v3) need to migrate to `catalog:effect` (v4) before upgrading.

  ### Catalog and manifest errors renamed and restructured

  `CatalogResolutionError` is removed. `resolveManifest()` now rejects with one of four typed errors re-exported from `@effected/npm`:

  ```ts
  import { resolveManifest, UnresolvedDependencyError, ManifestDecodeError } from "@savvy-web/tsdown-plugins";

  try {
  	await resolveManifest(pkg);
  } catch (error) {
  	if (error instanceof UnresolvedDependencyError) {
  		// error.field, error.dependency, error.specifier, error.reason
  		// reason: "catalog-entry-missing" | "workspace-package-missing"
  	}
  	if (error instanceof ManifestDecodeError) {
  		// a dependency field wasn't a string-to-string record
  	}
  }
  ```

  * `UnresolvedDependencyError` replaces `CatalogResolutionError`, with a different `_tag` and a different field shape (`field`, `dependency`, `specifier`, `reason`).
  * `CatalogAssemblyError` is now the `@effected/npm` re-export — same `_tag`, but its fields changed (`source: "manifest" | "catalog" | "hooks"`, `path`, `cause`), so cross-package `instanceof` checks against the old class break.
  * `ManifestDecodeError` and `DependencyResolutionError` are new exports. `resolveManifest`'s full rejection set is now these four errors.

  ### Dependency graph

  The sealed v3 peer closure (`@effect/cluster`, `@effect/experimental`, `@effect/platform`, `@effect/rpc`, `@effect/sql`, `@effect/workflow`) is removed — v4's closure is just `effect`. `workspaces-effect`, `json-schema-effect`, and `@manypkg/get-packages` are replaced by `@effected/workspaces`, `@effected/npm`, and `@effected/tsconfig-json`. `typescript` stays pinned at `^6.0.3` (still used for dts AST work and api-extractor).

### Bug Fixes

* `resolveManifest` on a malformed dependency field (a non-record field, or a non-string specifier) now rejects with a typed `ManifestDecodeError` instead of an untyped defect.
* `workspace:<alias>@<range>` specifiers now project to the correct `npm:<alias>@<projected>` publish form — previously this alias form passed through unresolved.
* `readTsconfigJsx`/`resolveJsxConfig` now honor JSONC syntax and `extends` chains, so a `jsx` setting inherited from a base tsconfig resolves instead of being missed.
* The portable-tsconfig allow-list used by `resolvePortableTsconfig` is now a superset of the previous one — options like `allowJs`/`experimentalDecorators` survive when set. `newLine` is no longer emitted, and malformed configs now fail through typed decoding with strict enum literals instead of a looser TypeScript-API pass-through. [#309][#309]

### Dependencies

* | Dependency              | Type       | Action  | From     | To            |                                                                       |
  | ----------------------- | ---------- | ------- | -------- | ------------- | --------------------------------------------------------------------- |
  | @effect/cluster         | dependency | removed | ^0.59.0  | —             |                                                                       |
  | @effect/experimental    | dependency | removed | ^0.60.0  | —             |                                                                       |
  | @effect/platform        | dependency | removed | ^0.96.2  | —             |                                                                       |
  | @effect/rpc             | dependency | removed | ^0.75.1  | —             |                                                                       |
  | @effect/sql             | dependency | removed | ^0.51.1  | —             |                                                                       |
  | @effect/workflow        | dependency | removed | ^0.18.2  | —             |                                                                       |
  | @manypkg/get-packages   | dependency | removed | ^3.1.0   | —             |                                                                       |
  | json-schema-effect      | dependency | removed | ^0.3.0   | —             |                                                                       |
  | workspaces-effect       | dependency | removed | ^2.1.0   | —             |                                                                       |
  | @effect/platform-node   | dependency | updated | ^0.107.0 | 4.0.0-beta.98 |                                                                       |
  | effect                  | dependency | updated | ^3.21.4  | 4.0.0-beta.98 |                                                                       |
  | @effected/npm           | dependency | added   | —        | ^0.2.0        |                                                                       |
  | @effected/tsconfig-json | dependency | added   | —        | ^0.2.0        |                                                                       |
  | @effected/workspaces    | dependency | added   | —        | ^0.2.0        | [#309][#309] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#309]: https://github.com/savvy-web/systems/pull/309

## 1.1.13

### Dependencies

* | Dependency | Type       | Action  | From    | To      |                                                          |
  | ---------- | ---------- | ------- | ------- | ------- | -------------------------------------------------------- |
  | tsdown     | dependency | updated | ^0.22.5 | ^0.22.7 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.1.12

### Dependencies

* | Dependency        | Type       | Action  | From   | To     |                                                                              |
  | ----------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.3 | ^2.1.0 | [#304][#304] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#304]: https://github.com/savvy-web/systems/pull/304

## 1.1.11

### Dependencies

* | Dependency | Type       | Action  | From    | To      |                                                          |
  | ---------- | ---------- | ------- | ------- | ------- | -------------------------------------------------------- |
  | tsdown     | dependency | updated | ^0.22.4 | ^0.22.5 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.1.10

### Bug Fixes

* Fix declaration builds in consumer repos that install TypeScript 7. The dts and declarations passes now pin rolldown-plugin-dts' generator to `tsc` instead of letting it auto-detect, and tsdown moves from devDependencies to regular dependencies so the runtime `import("tsdown")` in `buildTargetGroups` and `runExeBuild` resolves deterministically against this package's pinned `typescript ^6.0.3` rather than a host-hoisted instance peered to the host's TypeScript. Previously, a consumer with TypeScript 7 in its root closure resolved a tsdown instance whose rolldown-plugin-dts auto-detected the `tsgo` generator, which derives `--rootDir` from the synthesized tmpdir tsconfig's directory and emits nothing (TS6059), failing builds with "tsgo did not generate dts file". [#281][#281]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#281]: https://github.com/savvy-web/systems/pull/281

## 1.1.9

### Dependencies

* | Dependency | Type       | Action  | From   | To     |                                                                       |
  | ---------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | std-env    | dependency | updated | ^4.1.0 | ^4.2.0 | [#278][#278] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#278]: https://github.com/savvy-web/systems/pull/278

## 1.1.8

### Dependencies

* | Dependency        | Type       | Action  | From   | To     |                                                          |
  | ----------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.2 | ^2.0.3 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.1.7

### Refactoring

* Replaced the `deep-equal` dependency with `node:util`'s `isDeepStrictEqual` in the tsdoc.json idempotent-write check
* `deep-equal` and `@types/deep-equal` removed from dependencies
* No behavior change [#240][#240]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#240]: https://github.com/savvy-web/systems/pull/240

## 1.1.6

### Bug Fixes

* Sealed the toolchain's Effect peer-dependency graph by declaring the full required-peer closure as regular dependencies: `effect` (previously peer-only), `@effect/platform`, `@effect/rpc`, `@effect/sql`, `@effect/cluster`, `@effect/experimental`, and `@effect/workflow` (all previously undeclared, reachable only as auto-installed peers of `@effect/platform-node`, `@effect/sql`, and `@effect/cluster`). In a consumer workspace with `autoInstallPeers`, pnpm installed the missing peers at the consumer's importer level, so a consumer depending on a different major of `effect` could poison peer resolution — binding `@effect/platform` against an incompatible `effect` version and crashing `savvy.build.ts` with `ERR_MODULE_NOT_FOUND` on `effect/Either`. Every peer in the closure now resolves from the toolchain's own `effect` v3 context regardless of the consumer's `effect` version (#228) [#232][#232]

### Dependencies

* | Dependency        | Type       | Action  | From   | To     |                                                                       |
  | ----------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.1 | ^2.0.2 | [#232][#232] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#232]: https://github.com/savvy-web/systems/pull/232

## 1.1.5

### Bug Fixes

* Fixed `bundleNodeModules: true` builds emitting a per-module (`preserveModules`) ESM output whose inlined `node_modules` dependencies lived in sibling chunk files nested under `node_modules/...` paths. `npm pack` strips any directory literally named `node_modules` from the published tarball, so the packed ESM entry threw `Cannot find module` once installed. `unbundle` now turns off automatically whenever `bundleNodeModules` is set (including per-entry overrides), producing a single self-contained file per format.
* Silenced rolldown's `PLUGIN_TIMINGS` plugin-performance diagnostic in normal builds — the builder's own always-on plugins tripped it on virtually every run, making it unactionable noise. Verbose mode keeps the timings available for profiling sessions. [#223][#223]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#223]: https://github.com/savvy-web/systems/pull/223

## 1.1.4

### Dependencies

* | Dependency                   | Type       | Action  | From    | To            |                                                                       |
  | ---------------------------- | ---------- | ------- | ------- | ------------- | --------------------------------------------------------------------- |
  | @changesets/get-release-plan | dependency | updated | ^4.0.16 | ^5.0.0-next.7 | [#218][#218] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#218]: https://github.com/savvy-web/systems/pull/218

## 1.1.3

### Dependencies

* [`5ada627`](https://github.com/savvy-web/systems/commit/5ada627c7e8b959036f0a7e1bf9ecaf4978136c8) | Dependency | Type | Action | From | To |
  \| --------------------- | ---------- | ------- | ------ | ------ |
  \| @manypkg/get-packages | dependency | updated | ^1.1.3 | ^3.1.0 |

## 1.1.2

### Bug Fixes

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) Upgrade transient semver-effect library to correct side effect issues in bundles.

### Dependencies

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) | Dependency | Type | Action | From | To |
  \| ----------------- | ---------- | ------- | ------ | ------ |
  \| workspaces-effect | dependency | updated | ^1.2.0 | ^2.0.1 |

## 1.1.1

### Dependencies

* [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) | Dependency | Type | Action | From | To |
  \| ------------------ | ---------- | ------- | ------ | ------ |
  \| json-schema-effect | dependency | updated | ^0.2.4 | ^0.3.0 |

## 1.1.0

### Features

* [`b2c530d`](https://github.com/savvy-web/systems/commit/b2c530da08cdcfb87422f7c616d3a1dc3b1d2955) Threaded a new `emitDts?: boolean` option through the public build interfaces so `@savvy-web/bundler` can skip declaration generation on prod builds:

- `BuildTargetGroupsOptions`, `EmitManifestOptions`, `BuildEmittedManifestOptions`, and `TransformManifestOptions` all accept `emitDts`
- `transformExports` accepts the flag and, when dts is skipped, omits the `types` condition from generated `exports` entries so they never point at declarations that were never written
- Default is `true`, matching today's behavior when the option is omitted

See #198.

### Performance

* [`b2c530d`](https://github.com/savvy-web/systems/commit/b2c530da08cdcfb87422f7c616d3a1dc3b1d2955) `buildEmittedManifest` now skips the `resolveManifest(pkg)` call — a full `workspaces-effect` `CatalogResolver` plus pnpm-workspace and lockfile assembly — when the manifest has no `catalog:`/`workspace:` specifiers in any dependency field. A new `manifestNeedsCatalogResolution` guard gates the call.

- Behavior-preserving: `resolveManifest` already returned such manifests unchanged, so this is a pure speedup on every prod build of a catalog-free package
- Removes host-workspace coupling from in-process unit tests

See #196.

## 1.0.1

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so the package picks up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds a `LICENSE` file and minor `tsconfig.json` corrections. No runtime behavior changes.

## 1.0.0

### Breaking Changes

* [`ceeca34`](https://github.com/savvy-web/systems/commit/ceeca34f4ac4b7fdca7321c5016321f5be084768) ### `syncPublicDir` removed; public asset contents are copied into the package

`syncPublicDir` has been removed from the public API. Replace it with `copyPublicDir`:

```ts
// Before
import { syncPublicDir } from "@savvy-web/tsdown-plugins";
syncPublicDir(sourceDir, targetDir);

// After
import { copyPublicDir } from "@savvy-web/tsdown-plugins";
copyPublicDir(sourceDir, outDir);
```

`copyPublicDir` copies the CONTENTS of `sourceDir` into `outDir` additively — only the `public/` directory segment is dropped, so a file at `sourceDir/<rel>` lands at `outDir/<rel>` with its substructure preserved. A `public/tsconfig/ecma.json` asset therefore publishes at `<pkg>/tsconfig/ecma.json` instead of `<pkg>/public/tsconfig/ecma.json`.

Behavioral differences from `syncPublicDir`:

* Additive only — never deletes files from `outDir`; a `clean: true` build handles stale-asset pruning.
* Collision guard — if a built output already occupies the destination and its bytes differ, `copyPublicDir` throws `ConfigValidationError` rather than overwriting.
* Timing — runs after all build passes (JS, dts, declarations, looseFiles) rather than after the base JS pass only.

### Features

* [`8078799`](https://github.com/savvy-web/systems/commit/8078799b0261729efe897f1084ed532348f3a1b6) ### Ambient `.d.ts` exports

A package can now declare a types-only `exports` entry whose source is a hand-authored declaration file — either a bare `.d.ts` string or an object with a `types` key pointing at a `.d.ts` — and the build handles everything automatically. No custom `transform` and no post-build step required.

Both forms are accepted in `package.json`:

```json
{
  "exports": {
    "./virtual": "./src/virtual.d.ts",
    "./types": { "types": "./src/types.d.ts" }
  }
}
```

The published manifest is rewritten so each key maps to a dist path derived from the export key:

```json
{
  "exports": {
    "./virtual": { "types": "./virtual.d.ts" },
    "./types": { "types": "./types.d.ts" }
  }
}
```

The source file is copied verbatim into every built target dir (`dist/dev/pkg` for `--target dev`; `dist/prod/<group>/pkg` for each prod group).

**Constraints** — each a `ConfigValidationError` that fails the build immediately:

* The source must be self-contained. A relative `import`, `export … from`, `import("…")` type node, or `/// <reference path="…" />` is rejected with the offending specifier(s) listed.
* A mixed export — a hand-authored `types` `.d.ts` alongside a compilable runtime `import`/`require`/`default` entry — throws. The bundler generates types from runtime sources; only types-only entries may be hand-authored.
* An output name colliding with another ambient entry or with a JS build entry throws.

**Compatibility:** Existing exports whose *key* is itself a `.d.ts` path (the RSPress public-asset pattern, e.g. `"./rspress-env.d.ts": …`) are untouched — only entries whose *value* is a declaration path are classified as ambient.

New exports:

* `extractAmbientDts(pkg, options?)` — extract all types-only `.d.ts` exports from a package's `exports` map; throws `ConfigValidationError` on mixed exports or output-name collisions.
* `classifyDtsExport(value)` — classify a single export value as `"ambient"`, `"mixed"`, or `"none"`.
* `ambientOutName(exportKey, source, exportsAsIndexes?)` — derive the output basename from an export key, preserving the source's declaration extension.
* `declarationExt(path)` — return `.d.ts`, `.d.cts`, or `.d.mts` if the path is a declaration file, otherwise `undefined`.
* `assertNoEntryCollisions(jsEntryNames, ambient)` — throw if any ambient output name (extension-stripped) collides with a JS build entry.
* `mixedDtsExportError(exportKey)` — construct the shared `ConfigValidationError` for a mixed export.
* `findRelativeSpecifiers(source, fileName?)` — parse a declaration source and return every relative `import`/`export`/reference specifier; pure, no I/O.
* `copyAmbientDts(options)` — copy each resolved ambient source verbatim into `outDir/<outName>`, byte-stable (unchanged files keep their timestamp).
* Types: `AmbientDtsEntry`, `DtsExportClass`, `ExtractAmbientOptions`, `CopyAmbientDtsOptions`.

## 0.12.0

### Features

* [`2ab83d4`](https://github.com/savvy-web/systems/commit/2ab83d477f07258cf1e0387b908b807743051db0) ### Deterministic, self-contained per-entry declarations

The declaration pass now emits one self-contained `.d.ts` per public entry instead of rolling every entry through a single multi-entry pass. A multi-entry package no longer produces a cross-entry, content-hashed shared declaration chunk, so its declaration output is stable across clean rebuilds.

* A secondary entry that is a pure named re-export of a subset of the primary `index` entry is emitted as a thin `export { … } from "./index.js"` stub instead of re-inlining the shared surface, so re-export-heavy multi-entry packages stay compact.
* The declaration-emit TypeScript pass runs with `stableTypeOrdering`, so union and type members serialize in a stable order across builds. It is scoped to the emit pass only, so the bundled API Extractor (which predates the flag) is unaffected.

### Bug Fixes

* [`2ab83d4`](https://github.com/savvy-web/systems/commit/2ab83d477f07258cf1e0387b908b807743051db0) Declaration (`.d.ts`) and API-model (`.api.json`) output is now byte-reproducible across repeated clean builds of multi-entry packages. Previously the shared declaration chunk's name and layout, plus TypeScript union-member ordering, varied between otherwise-identical builds.

## 0.11.2

### Bug Fixes

* [`577d242`](https://github.com/savvy-web/systems/commit/577d242edd260dc75a04d6b95e3ffc33a3e040c0) The API Extractor doc model now sets `includeForgottenExports: true`, so declarations that are referenced but not exported are retained in the emitted `.api.json` instead of being dropped. The motivating case is the synthetic `*_base` class TypeScript hoists when emitting declarations for Effect class mixins (`Schema.Class`, `Data.TaggedError`, `Context.Tag`, `Effect.Service`): its name is not exportable from source, so it was always a forgotten export and the model lost it — leaving a dangling `extends *_base` over an empty class body and corrupting downstream `.d.ts` reconstruction. The `ae-forgotten-export` diagnostic is unchanged (a warning locally, CI-fatal by default, suppressible per package); it now flags a genuinely forgotten public export rather than guarding against model corruption.

- [`577d242`](https://github.com/savvy-web/systems/commit/577d242edd260dc75a04d6b95e3ffc33a3e040c0) Removed the non-functional `jsx` field from `BuildTargetGroupsOptions`, `DeriveOptions`, and the three derived pass-option interfaces. The field was being forwarded into rolldown's `inputOptions`, which rejected it on every JSX build pass with an "Invalid input options ... Expected never but received "jsx"" warning. JSX compilation was already applied correctly via the generated tsconfig, so the forward had no effect on emitted output.

* `JsxConfig`, `resolveJsxConfig`, and `readTsconfigJsx` remain exported and unchanged

## 0.11.0

### Features

* [`a92e92f`](https://github.com/savvy-web/systems/commit/a92e92f7069eaf83a686806b95d87afc841f0033) ### Surface rollup-only CI-fatal forgotten-exports in local builds

Meta generation runs API Extractor twice: once over the bundled rollup `.d.ts` (the shipped model) and once over the per-module declaration tree (for accurate source locations). A CI-fatal `ae-forgotten-export` that exists ONLY in the bundled rollup — for example an external type inlined into the bundled declarations dragging in symbols the entry point does not export — was reported by neither run locally: the rollup run's diagnostics were discarded as having unreliable locations, and the per-module run never sees the issue because that package stays an external import there. The result was a build that looked clean locally but failed hard on CI.

The bundled-rollup run now captures its CI-fatal messages and, after the per-module run, surfaces the ones the per-module run did not also report — with the unreliable rollup location stripped — so a local build nudges (`[fails CI]`) instead of passing silently. Messages present in both runs are still reported once, with the per-module run's accurate location. Under CI the same rollup-only fatal escalates to a hard error that throws before the per-module run, so the bundled-rollup run now forwards its error-level diagnostics to the build report first — the failure names the offending symbol instead of an opaque "N error(s)". The shipped api-model and the CI gate itself are unchanged; this only adds reporting.

## 0.10.0

### Features

* [`d7fd974`](https://github.com/savvy-web/systems/commit/d7fd9740ee58347e0c2c92af66edb8289016dd80) ### Accurate `file`/`line`/`column` on API Extractor diagnostics

`ae-*` and `tsdoc-*` diagnostics in `dist/prod/issues.json` now carry accurate `file`, `line`, and `column` fields pointing at the true source declaration.

The meta pass previously analyzed only the bundled `.d.ts`, whose source-map positions anchor to the start of an adjacent declaration rather than the symbol itself. The workaround (systems#154) dropped location fields entirely. This release replaces that workaround: the prod meta pass now runs API Extractor a second time over a per-module declaration tree (`dist/prod/<id>/declarations/`) where each `.d.ts.map` references only its own source file, so positions resolve correctly.

The bundled api-model (consumed by RSPress / API-doc rendering) is unchanged — it is still produced from the bundled `.d.ts`.

**Consumer-visible side effects:**

* A new `dist/prod/<id>/declarations/` artifact tree is emitted during prod builds. It is kept locally but not published to npm.
* The prod meta pass now runs API Extractor twice, adding a fixed-overhead build step.
* For Effect `Data.TaggedError` / service classes built from a synthesized `_base` declaration, rolldown-plugin-dts does not source-map the `_base` synthesis, so those diagnostics may report a path inside `declarations/*.d.ts` rather than the original `src/*.ts`. Use the symbol name quoted in the diagnostic `text` to locate the declaration in source.

### Reverts

* [`d7fd974`](https://github.com/savvy-web/systems/commit/d7fd9740ee58347e0c2c92af66edb8289016dd80) Reverts the systems#154 mitigation that suppressed `file`/`line`/`column` from API Extractor diagnostics. Consumers who adapted tooling to the absent-location behavior should revert those workarounds.

### New public option fields

Three new additive options are available for advanced use cases:

* `BuildTargetGroupsOptions.emitDeclarations` — controls whether the build loop emits the per-module declaration tree (default: `false` for `dev`, `true` for `prod`)
* `RunApiExtractorOptions.emitDocModel` — controls whether the API Extractor pass writes its `.api.json` model (default: `true`)
* `GenerateMetaOptions.aeInputDir` — overrides the directory that the meta pass's diagnostics-only run reads declarations from

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
