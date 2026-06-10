# @savvy-web/github-action-builder

## 0.7.5

### Build System

* [`09dc242`](https://github.com/savvy-web/systems/commit/09dc24206868d50fa885adb6985d7d7d8ec62578) Now built with `@savvy-web/bundler`.

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
