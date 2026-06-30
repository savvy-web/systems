# @savvy-web/pnpm-plugin-silk

## 0.17.0

### Bug Fixes

* [`32151e5`](https://github.com/savvy-web/pnpm-plugin-silk/commit/32151e5da02679c3cb31f7c882948ece126dd9ab) Explicitly overrides @types/node to ^26.0.0 instead of using catalog version

## 0.16.1

### Bug Fixes

* [`8986301`](https://github.com/savvy-web/pnpm-plugin-silk/commit/89863018ba329bc5cec9a9c1d3b891285002a48d) Override `@types/node` with Silk catalog version.

## 0.16.0

### Features

* [`7260973`](https://github.com/savvy-web/pnpm-plugin-silk/commit/726097330d736cf0c85ea69c4c87dbc1cb1535ac) ### Generalized source-repo hoist exclusion

The plugin now uses a repo-to-packages map to exclude workspace-local packages from `publicHoistPattern` when the consuming repo is its own source monorepo. Previously only the `savvy-web-systems` repo (excluding `@savvy-web/cli` and `@savvy-web/mcp`) was handled. Now `vitest-agent` is also recognized, dropping `@vitest-agent/cli` and `@vitest-agent/mcp` from the hoist set inside that repo.

Consumer repos are unaffected — they continue to receive the full `publicHoistPattern` with all packages hoisted.

### Dependencies

* | [`7260973`](https://github.com/savvy-web/pnpm-plugin-silk/commit/726097330d736cf0c85ea69c4c87dbc1cb1535ac) | Dependency | Type    | Action  | From    | To |
  | :--------------------------------------------------------------------------------------------------------- | :--------- | :------ | :------ | :------ | -- |
  | effect                                                                                                     | config     | updated | ^3.21.3 | ^3.21.4 |    |
  | @effect/platform                                                                                           | config     | updated | ^0.96.1 | ^0.96.2 |    |
  | @effect/ai-amazon-bedrock                                                                                  | config     | updated | ^0.16.0 | ^0.16.1 |    |
  | @effect/ai-openai                                                                                          | config     | updated | ^0.40.0 | ^0.40.1 |    |
  | @types/node                                                                                                | config     | updated | ^25.9.3 | ^26.0.0 |    |

### Silk ships `allowedDeprecatedVersions` defaults

Silk now provides a baseline set of `allowedDeprecatedVersions` entries (`glob`, `inflight`, `prebuild-install`) so child workspaces inherit them without needing to declare them manually. The existing merge behavior (child value wins per key, no warning) is unchanged — child workspaces can override individual entries or add their own.

## 0.15.2

### Features

* [`33d5e2a`](https://github.com/savvy-web/pnpm-plugin-silk/commit/33d5e2abbf716148e1b978ac13ee52a710caa300) Add `@vitest-agent/*` to minimumReleaseAgeExclude in preperation for new test harness release.

## 0.15.1

### Features

* [`4048445`](https://github.com/savvy-web/pnpm-plugin-silk/commit/4048445e581d75334be5bd5dcc908f2340f028c4) Exclude core effect packages from minimum release age requirements.

## 0.15.0

### Features

* [`71c70ca`](https://github.com/savvy-web/pnpm-plugin-silk/commit/71c70cac4a18f61136f01b464b4523fe4c90956a) ### `confirmModulesPurge` managed setting

Silk now injects `confirmModulesPurge: false` into the consuming workspace's pnpm config as a behavioral default. When pnpm considers purging the `node_modules` store, this setting suppresses the interactive confirmation prompt — keeping installs non-interactive in CI and scripted environments without requiring each repo to set it manually.

This is a plain behavioral default, not a security setting:

* A child workspace's own `confirmModulesPurge` value wins (child-wins merge via `mergeScalar`).
* No warning is emitted when the child value diverges. Repos that want interactive confirmation can set `confirmModulesPurge: true` in their own `pnpm-workspace.yaml`.

```yaml
# pnpm-workspace.yaml in a child repo — overrides Silk's default
confirmModulesPurge: true
```

If the child repo sets no value, Silk's `false` applies automatically.

### Dependencies

* | [`71c70ca`](https://github.com/savvy-web/pnpm-plugin-silk/commit/71c70cac4a18f61136f01b464b4523fe4c90956a) | Dependency | Type    | Action                | From                  | To |
  | :--------------------------------------------------------------------------------------------------------- | :--------- | :------ | :-------------------- | :-------------------- | -- |
  | @typescript/native-preview                                                                                 | config     | updated | ^7.0.0-dev.20260611.2 | ^7.0.0-dev.20260612.1 |    |

## 0.14.6

### Build System

* [`1bfa379`](https://github.com/savvy-web/pnpm-plugin-silk/commit/1bfa379edb222284312d737a24c41ea2d6afe738) Migrated build tooling from `tsdown` to `@savvy-web/bundler`. The published bundle (`pnpmfile.mjs` / `pnpmfile.cjs`) is functionally unchanged; only internal build configuration and output directory layout were updated.

### Maintenance

* [`1bfa379`](https://github.com/savvy-web/pnpm-plugin-silk/commit/1bfa379edb222284312d737a24c41ea2d6afe738) Updated Effect ecosystem catalog entries (`catalog:silk` and `catalog:silkPeers`) to the latest compatible releases. Consumer repos that reference `catalog:silk` entries will receive these pinned ranges on their next `pnpm install` after upgrading this plugin.

Notable bumps:

* `effect` ^3.21.2 → ^3.21.3
* `@effect/cluster` ^0.58.2 → ^0.59.0
* `@effect/platform-node` ^0.106.0 → ^0.107.0
* `@effect/platform-node-shared` ^0.59.0 → ^0.60.0
* `@effect/platform-bun` ^0.89.0 → ^0.90.0
* `@effect/ai` / `@effect/ai-*` family ^0.35.x → ^0.36.x
* `@effect/cli` ^0.75.1 → ^0.75.2
* `@effect/rpc` ^0.75.0 → ^0.75.1 (silkPeers floor)
* `@effect/sql-clickhouse` ^0.48.0 → ^0.49.0
* `@effect/tsgo` ^0.13.1 → ^0.14.3
* `@effect/workflow` ^0.18.1 → ^0.18.2

## 0.14.5

### Other

* [`6d7e86a`](https://github.com/savvy-web/pnpm-plugin-silk/commit/6d7e86ace349622381a9adc02176e81e5d8dadd6) Fixes silk repo exclusion logic for mcp and cli hoisting

## 0.14.4

### Other

* [`de6d023`](https://github.com/savvy-web/pnpm-plugin-silk/commit/de6d02339faaf2251d1954cf068e3fccb52359e1) Avoid hoisting @savvy-web/cli and @savvy-web/mcp in the source repo.

## 0.14.3

### Bug Fixes

* [`3160306`](https://github.com/savvy-web/pnpm-plugin-silk/commit/3160306ba8d2d09ce1a87a5d1de6c89659498a03) The published config dependency now loads under `pnpm run` / `pnpm exec`, not just `pnpm install`.

pnpm 11.5.1 resolves config-dependency pnpmfiles through two different code paths. The install path is mjs-aware and prefers `pnpmfile.mjs`, but the lifecycle path that backs `pnpm run` and `pnpm exec` (what Turbo invokes) uses a legacy resolver that probes only `pnpmfile.cjs`. Since 0.14.x shipped `pnpmfile.mjs` alone, consuming repos installed cleanly but failed any `pnpm run`-driven build with `ERR_PNPM ... pnpmfile.cjs is not found`.

The build now emits both a self-contained ESM `pnpmfile.mjs` and a real CommonJS `pnpmfile.cjs` (not a shim that re-imports the mjs — pnpm reads `hooks` synchronously at load), both built from the same source so they stay behaviorally identical. The install path keeps using the `.mjs`; the lifecycle path now finds the `.cjs`.

* `tsdown` emits both `esm` and `cjs` formats
* both `pnpmfile.cjs` and `pnpmfile.mjs` are listed in the published `files`

## 0.14.2

### Other

* [`ecf769b`](https://github.com/savvy-web/pnpm-plugin-silk/commit/ecf769b5e89cee26f77a7bce307764e903da9a2b) More temporary ignores

## 0.14.1

### Other

* [`56001b1`](https://github.com/savvy-web/pnpm-plugin-silk/commit/56001b14cfafcb6b70967fd7eaa57a9b696931e4) Temporarily disable minimumReleaseAge for certain dependencies

## 0.14.0

### Features

* [`58d85c5`](https://github.com/savvy-web/pnpm-plugin-silk/commit/58d85c515658fb7591bbbf6e03d7db5ac1f79810) ### pnpm 11 Support

The published artifact is now a self-contained ESM module (`pnpmfile.mjs`) built
with tsdown. pnpm 11 loads config dependencies as native ESM, and this release
aligns the plugin with that requirement.

### Dependencies

* | [`58d85c5`](https://github.com/savvy-web/pnpm-plugin-silk/commit/58d85c515658fb7591bbbf6e03d7db5ac1f79810) | Dependency    | Type    | Action   | From    | To |
  | :--------------------------------------------------------------------------------------------------------- | :------------ | :------ | :------- | :------ | -- |
  | @savvy-web/changesets                                                                                      | devDependency | removed | ^0.10.1  | —       |    |
  | @savvy-web/commitlint                                                                                      | devDependency | removed | ^0.10.1  | —       |    |
  | @savvy-web/lint-staged                                                                                     | devDependency | removed | ^1.2.1   | —       |    |
  | @savvy-web/rslib-builder                                                                                   | devDependency | removed | ^0.20.11 | —       |    |
  | @savvy-web/silk                                                                                            | devDependency | added   | —        | ^0.2.0  |    |
  | tsdown                                                                                                     | devDependency | added   | —        | ^0.22.1 |    |

### `allowBuilds` Replaces `onlyBuiltDependencies`

The deprecated pnpm 10 `onlyBuiltDependencies` setting is replaced by pnpm 11's
`allowBuilds` map. The silk catalog now ships a curated `silkAllowBuilds` map
(package matcher → boolean) that child configs can extend key-by-key (child wins
per key).

```yaml
# .npmrc / pnpm config in child repo — these keys merge on top of silk defaults
allowBuilds:
  esbuild: true
  sharp: false
```

### New Security Defaults

The plugin now owns and injects pnpm 11 build/security defaults that child
repos can override. Each default emits a prominent security warning box when a
child config weakens it (enables a blocked build, disables the flag, or lowers
the release-age threshold):

| Setting                    | Silk Default | Behavior                                      |
| :------------------------- | :----------- | :-------------------------------------------- |
| `strictDepBuilds`          | `true`       | Fail install on unreviewed build scripts      |
| `blockExoticSubdeps`       | `true`       | Block git/tarball sources for transitive deps |
| `minimumReleaseAge`        | (configured) | Minimum minutes since publication             |
| `minimumReleaseAgeExclude` | `[]`         | Package patterns exempt from the age check    |

### New Inherited Settings

Four additional pnpm settings are now managed and merged by the plugin:

* **`packageExtensions`** — add missing metadata (deps, peer deps) to published
  packages that ship incomplete `package.json` files. Child entries are merged
  on top of silk defaults.
* **`allowedDeprecatedVersions`** — mute specific deprecation warnings. Merged
  map; child wins per key.
* **`supportedArchitectures`** — constrain optional-dependency installation by
  OS, CPU, and libc. Child arrays are unioned with silk defaults.
* **`auditConfig`** — allowlist GHSA or CVE identifiers from `pnpm audit`.
  Child arrays are unioned with silk defaults.

### New Public Types

Three TypeScript interfaces are now exported from the package entry point:

```typescript
import type {
  AuditConfig,
  PackageExtension,
  SupportedArchitectures,
} from "@savvy-web/pnpm-plugin-silk";
```

| Type                     | Shape                                                                                |
| :----------------------- | :----------------------------------------------------------------------------------- |
| `PackageExtension`       | `{ dependencies?, optionalDependencies?, peerDependencies?, peerDependenciesMeta? }` |
| `SupportedArchitectures` | `{ os?, cpu?, libc? }`                                                               |
| `AuditConfig`            | `{ ignoreGhsas?, ignoreCves? }`                                                      |

## 0.13.4

### Bug Fixes

* [`7661e8f`](https://github.com/savvy-web/pnpm-plugin-silk/commit/7661e8f92e07d27b1fdf7ea393188535d33023c9) Security release to remove issues with tmp < 0.27.0

## 0.13.3

### Dependencies

* | [`64ce87a`](https://github.com/savvy-web/pnpm-plugin-silk/commit/64ce87a375675022c8ca1e015fef26fb7cbc87eb) | Dependency | Type    | Action                | From                  | To |
  | :--------------------------------------------------------------------------------------------------------- | :--------- | :------ | :-------------------- | :-------------------- | -- |
  | @effect/tsgo                                                                                               | config     | updated | ^0.7.5                | ^0.11.0               |    |
  | @typescript/native-preview                                                                                 | config     | updated | ^7.0.0-dev.20260519.1 | ^7.0.0-dev.20260523.1 |    |

## 0.13.2

### Features

* [`5e25dfe`](https://github.com/savvy-web/pnpm-plugin-silk/commit/5e25dfe31c6d01af783e6fcad8b9e4ca78e4e9a0) Add `@effect/vitest` and `@effect/tsgo` to the silk and silkPeers catalogs.

- `@effect/vitest ^0.29.0` (silk) / `>=0.29.0` (silkPeers) — Effect-native Vitest integration
- `@effect/tsgo ^0.7.4` (silk) / `>=0.7.4` (silkPeers) — Effect Language Service TypeScript-Go extension

## 0.13.1

### Dependencies

* | [`299555a`](https://github.com/savvy-web/pnpm-plugin-silk/commit/299555a429d26d6d21f8b7828f7f904040577e4d) | Dependency | Type    | Action               | From                 | To |
  | :--------------------------------------------------------------------------------------------------------- | :--------- | :------ | :------------------- | :------------------- | -- |
  | @effect/language-service                                                                                   | config     | updated | 0.85.1               | 0.86.1               |    |
  | @effect/workflow                                                                                           | config     | updated | 0.18.0               | 0.18.1               |    |
  | @types/node                                                                                                | config     | updated | 25.6.0               | 25.7.0               |    |
  | @typescript/native-preview                                                                                 | config     | updated | 7.0.0-dev.20260424.2 | 7.0.0-dev.20260513.1 |    |
  | react                                                                                                      | config     | updated | 19.2.5               | 19.2.6               |    |
  | react-dom                                                                                                  | config     | updated | 19.2.5               | 19.2.6               |    |
  | @effect/language-service (silkPeers)                                                                       | config     | updated | 0.85.1               | 0.86.1               |    |
  | @typescript/native-preview (silkPeers)                                                                     | config     | updated | 7.0.0-dev.20260124.1 | 7.0.0-dev.20260513.1 |    |
  | pnpm                                                                                                       | config     | updated | 10.33.1              | 10.33.2              |    |

## 0.13.0

### Features

* [`3b9b09e`](https://github.com/savvy-web/pnpm-plugin-silk/commit/3b9b09e9a6350dc68882c8bd6cd1bad3a040bec6) Added `peerDependencyRules` sync: the plugin now merges `allowedVersions`, `ignoreMissing`, and `allowAny` from the Silk workspace into consuming workspaces using the same merge-and-warn pattern as catalogs and overrides. Local values take precedence; any local entry that diverges from the Silk-provided value emits a console warning at install time.
* Added `SilkPeerDependencyRules` type to the public API, representing the shape of the synced peer dependency rules.

### Refactoring

* [`3b9b09e`](https://github.com/savvy-web/pnpm-plugin-silk/commit/3b9b09e9a6350dc68882c8bd6cd1bad3a040bec6) Rewrote hook internals as Effect programs. `updateConfig` now returns `Effect<PnpmConfig, never, CatalogProvider | PeerDependencyRulesProvider>`, and the generation script uses an Effect program with a `FileSystem` service. The `pnpmfile.ts` entry point runs the Effect and returns the resolved config, so the pnpm hook signature is unchanged.
* Reorganized tests from `src/index.test.ts` into a structured `__test__/` directory with per-module unit test files and dedicated integration tests, growing coverage from 27 to 54 tests.
* Extracted merge logic into focused modules: `merge-arrays.ts`, `merge-catalogs.ts`, `merge-overrides.ts`, and `merge-peer-dependency-rules.ts`.

## 0.12.1

### Bug Fixes

* [`97d9bfd`](https://github.com/savvy-web/pnpm-plugin-silk/commit/97d9bfd36102a6fc1282c0afb25c9e50df9ad4e6) Corrects the Effect catalog resolver's `deriveSilkPeers` function to use the lowest peer dependency floor instead of the highest. Previously, silkPeers ranges converged to match silk values, defeating the purpose of permissive peer ranges.

### Dependencies

* | [`97d9bfd`](https://github.com/savvy-web/pnpm-plugin-silk/commit/97d9bfd36102a6fc1282c0afb25c9e50df9ad4e6) | Dependency    | Type    | Action                | From                 | To |
  | :--------------------------------------------------------------------------------------------------------- | :------------ | :------ | :-------------------- | :------------------- | -- |
  | effect                                                                                                     | devDependency | updated | ^3.21.0               | ^3.21.2              |    |
  | @effect/ai-openai                                                                                          | devDependency | updated | ^0.39.0               | ^0.39.2              |    |
  | @effect/cli                                                                                                | devDependency | updated | ^0.75.0               | ^0.75.1              |    |
  | @effect/cluster                                                                                            | devDependency | updated | ^0.58.0               | ^0.58.2              |    |
  | @effect/platform                                                                                           | devDependency | updated | ^0.96.0               | ^0.96.1              |    |
  | @effect/rpc                                                                                                | devDependency | updated | ^0.75.0               | ^0.75.1              |    |
  | @effect/sql                                                                                                | devDependency | updated | ^0.51.0               | ^0.51.1              |    |
  | @typescript/native-preview                                                                                 | devDependency | updated | ^7.0.0-dev.20260414.1 | 7.0.0-dev.20260422.1 |    |
  | typescript                                                                                                 | devDependency | updated | ^6.0.2                | ^6.0.3               |    |

## 0.12.0

### Breaking Changes

* [`5dce523`](https://github.com/savvy-web/pnpm-plugin-silk/commit/5dce5230a2215c3013430ec9a2703f13a2c0ccd1) Removed the `syncBiomeSchema` hook. This hook previously auto-updated `$schema` URLs in `biome.json`/`biome.jsonc` files on install. This functionality has migrated to `@savvy-web/lint-staged` — no action is needed if you are already using that package.
* Removed bundled `jsonc-parser` and `parse-gitignore` dependencies. The plugin bundle size is reduced as a result.

### Features

* [`5dce523`](https://github.com/savvy-web/pnpm-plugin-silk/commit/5dce5230a2215c3013430ec9a2703f13a2c0ccd1) Added `@effect/ai-amazon-bedrock` and `@effect/ai-google` to both `silk` and `silkPeers` catalogs.
* Added missing `silkPeers` entries for `@effect/platform-browser`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-bun`, and `@effect/vitest`.
* Bumped `@effect/language-service` to `^0.85.1` in both catalogs.
* Added `react`, `react-dom`, `@types/react`, and `@types/react-dom` to both `silk` and `silkPeers` catalogs.
* Updated `typescript` in `silk` to `^6.0.2` and in `silkPeers` to `^6.0.0`, adding TypeScript 6 support.

### Maintenance

* [`5dce523`](https://github.com/savvy-web/pnpm-plugin-silk/commit/5dce5230a2215c3013430ec9a2703f13a2c0ccd1) The `updateConfig` hook in `pnpmfile.ts` is now synchronous, removing unnecessary `async`/`await` overhead.

### Migration

If your project relied on Silk to keep Biome schema URLs current, install or update `@savvy-web/lint-staged`, which now owns that responsibility.

## 0.11.0

### Features

* [`7873adc`](https://github.com/savvy-web/pnpm-plugin-silk/commit/7873adc4d0d04e4001483a1d3626998ebe128fa6) Adds smol-toml override to resolve security warnings

## 0.10.1

### Bug Fixes

* [`2aed0d1`](https://github.com/savvy-web/pnpm-plugin-silk/commit/2aed0d1aee9068cf35014bc6309bccc919329ba9) Reverts to distributing Biome version through config dependency system

## 0.10.0

### Features

* [`438b13a`](https://github.com/savvy-web/pnpm-plugin-silk/commit/438b13a1ae7e5338c1b112f3ffb17e9bc9d6a807) Add effect-catalog-resolver skill and expand Effect ecosystem to 19 packages.

New Claude Code skill (`.claude/skills/effect-catalog-resolver/`) that discovers
all `@effect/*` packages from the npm registry, resolves the latest compatible
version set using peer dependency analysis, and proposes updates to
`pnpm-workspace.yaml` catalogs.

New tracked packages: `@effect/ai`, `@effect/ai-anthropic`, `@effect/ai-openai`,
`@effect/experimental`, `@effect/workflow`, `@effect/sql-sqlite-node`. All Effect
packages updated to latest compatible versions anchored on `effect@3.21.0`.

## 0.9.0

### Features

* [`271ad35`](https://github.com/savvy-web/pnpm-plugin-silk/commit/271ad35e1074ece2a1c4ef8b8dd1d67e02453064) Add 13 Effect ecosystem packages to silk and silkPeers catalogs for centralized
  version management: effect, @effect/platform, @effect/platform-node,
  @effect/platform-bun, @effect/cli, @effect/opentelemetry, @effect/printer,
  @effect/printer-ansi, @effect/typeclass, @effect/language-service,
  @effect/cluster, @effect/rpc, @effect/sql.

silkPeers uses >= floor ranges for 0.x @effect/\* packages to correctly handle
semver caret behavior on pre-1.0 versions.

## 0.8.0

### Features

* [`44c4642`](https://github.com/savvy-web/pnpm-plugin-silk/commit/44c46429c2539dfc8b73d28f51f0bfe489f9506a) Reverts contol of most peerDependencies to companion packages

- [`f8ad907`](https://github.com/savvy-web/pnpm-plugin-silk/commit/f8ad9074ed4cd67287351d77974775331ed55c75) Reverts control of vitest and linting peerDependencies to their compantion packages

## 0.7.0

### Features

* [`cc6dc9e`](https://github.com/savvy-web/pnpm-plugin-silk/commit/cc6dc9e9348e8ada416ff35ed8525f83b391bbd1) Changes control of Biome, changesets and commitlint peerDependencies to their respective modules

## 0.6.3

### Bug Fixes

* [`89ee553`](https://github.com/savvy-web/pnpm-plugin-silk/commit/89ee5535403b9927264a4a57dd90b20a269df2c5) pins @microsoft/api-extractor catalog versions temporarily to prevent [extentionless ESM exports regression](https://github.com/microsoft/rushstack/issues/5644)

## 0.6.2

### Bug Fixes

* [`fe6d481`](https://github.com/savvy-web/pnpm-plugin-silk/commit/fe6d481090c0db429508c6a262a2b55d3ac03160) Hoist @types/node, commitizen, tsx

## 0.6.1

### Bug Fixes

* [`f082d2e`](https://github.com/savvy-web/pnpm-plugin-silk/commit/f082d2eaf4d481210973743d1bba3558651f3552) Sets reasonalbe peers for all dependencies

## 0.6.0

### Features

* [`0303f9a`](https://github.com/savvy-web/pnpm-plugin-silk/commit/0303f9aada1e48b00b6e44cf68c055d631edd9c6) Allows @savvy-web/vitest into onlyBuiltDependencies
* Allows @savvy-web/github-action-builder into onlyBuiltDependencies

## 0.5.3

### Dependencies

* [`4c4a2b7`](https://github.com/savvy-web/pnpm-plugin-silk/commit/4c4a2b7eb5f7b335e729b553304a4c96eee31343) Updates Biome to 2.4.1

## 0.5.2

### Dependencies

* [`4b734d8`](https://github.com/savvy-web/pnpm-plugin-silk/commit/4b734d83f113870588f4eb9ffd155155e2fe1635) Security override for markdown-it vulnerability

## 0.5.1

### Bug Fixes

* [`2773064`](https://github.com/savvy-web/pnpm-plugin-silk/commit/27730644f346e81fdf5588240ac83f0c346c11da) Bundle jsonc-parser

## 0.5.0

### Features

* [`6b28769`](https://github.com/savvy-web/pnpm-plugin-silk/commit/6b28769a17b28559d3647cab3618a704af24dd54) Support for @savvy-web/changesets system

## 0.4.4

### Patch Changes

* caa4d48: Update dependencies:

  **Dependencies:**

  * @savvy-web/commitlint: ^0.3.1 → ^0.3.2
  * @savvy-web/rslib-builder: ^0.12.1 → ^0.12.2

## 0.4.3

### Patch Changes

* f07b189: Updates dependencies

## 0.4.2

### Patch Changes

* d84cdb4: Update dependencies

## 0.4.1

### Patch Changes

* 2fa447f: Updates dependencies

## 0.4.0

### Minor Changes

* 2db03cc: Add automatic Biome schema version synchronization

  When `@savvy-web/lint-staged` is a workspace dependency, the plugin now
  automatically updates `$schema` URLs in `biome.json`/`biome.jsonc` files to
  match the catalog version of `@biomejs/biome`. Uses comment-preserving JSONC
  edits via `jsonc-parser` and respects `.gitignore` patterns when searching for
  config files via Node's built-in `fs.promises.glob`.

### Patch Changes

* 2db03cc: Updates dependencies

## 0.3.0

### Minor Changes

* 88c97f4: Adds onlyBuiltDependencies and publicHoistPatterns support

## 0.2.0

### Minor Changes

* 18a0a3d: Add security override support for transitive dependency CVEs
  * Added `silkOverrides` to sync pnpm `overrides` configuration across consuming repos
  * Security fixes included: `@isaacs/brace-expansion` (CVE-2026-25547), `lodash` (CVE-2025-13465), `tmp` (GHSA-52f5-9888-hmc6)
  * Override warnings alert when local overrides diverge from Silk-managed versions
  * Updated generator to read overrides from `pnpm-workspace.yaml`

## 0.1.0

### Minor Changes

* f849d68: Initial implementation of pnpm config dependency for centralized catalog management.

  **Features:**

  * `catalog:silk` - Current/latest versions for direct dependencies
  * `catalog:silkPeers` - Permissive ranges for peerDependencies
  * Override warnings with prominent console output when local versions diverge from Silk defaults
  * Auto-generation of catalogs from `pnpm-workspace.yaml` via `scripts/generate-catalogs.ts`

  **Technical:**

  * Self-contained CommonJS bundle (`pnpmfile.cjs`) via rslib-builder virtualEntries
  * 15 unit tests covering catalog merging, override detection, and warning formatting
  * Full TSDoc documentation with `@public` and `@internal` visibility tags
