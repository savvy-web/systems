# @savvy-web/silk

## 1.3.6

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 1.3.5 | 1.4.0 |

## 1.3.5

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so these packages pick up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds `LICENSE` files and applies minor manifest and `tsconfig.json` corrections across the three packages in the fixed release group, including moving `@savvy-web/silk-effects` to `devDependencies` in `@savvy-web/silk` (it is build-time only). No runtime behavior changes.
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 1.3.4 | 1.3.5 |
  | @savvy-web/mcp | dependency | updated | 1.3.4 | 1.3.5 |

## 1.3.4

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 1.3.3 | 1.3.4 |
| @savvy-web/cli | dependency | updated | 1.3.3 | 1.3.4 |

## 1.3.3

### Bug Fixes

* [`6a6591c`](https://github.com/savvy-web/systems/commit/6a6591c6385e49ebc8ad60a5a89f66e646c756e6) Updated the shipped Biome asset (`@savvy-web/silk/biome`) to Biome 2.5.1 and broadened the `noUndeclaredDependencies` suppression override.

- `$schema` URL updated to `https://biomejs.dev/schemas/2.5.1/schema.json`
- `noUndeclaredDependencies` is now suppressed for `**/__test__/**`, `**/*.spec.*`, `**/vitest.config.*`, `**/vitest.setup.*`, `**/vitest.env.*`, `**/vitest.globals.*`, and `**/vite.config.*` — previously only `**/*.test.ts` was covered
- the optional `@biomejs/biome` peer dependency range loosened from an exact `2.4.16` pin to `~2.5.0` (the 2.5 minor line)
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 1.3.2 | 1.3.3 |
  | @savvy-web/mcp | dependency | updated | 1.3.2 | 1.3.3 |

## 1.3.2

### Documentation

* [`d7fd974`](https://github.com/savvy-web/systems/commit/d7fd9740ee58347e0c2c92af66edb8289016dd80) The `/silk:tsdoc` skill's guidance on locating `ae-*` and `tsdoc-*` diagnostics has been updated to reflect that `file`/`line`/`column` fields in `issues.json` are now accurate.

- The previous guidance (systems#154) advised locating diagnostics by the symbol name quoted in `text`, because location fields were suppressed as misleading. That guidance is reverted.
- The current guidance: navigate to the `file:line` reported in the diagnostic. Most entries resolve to `src/*.ts` (accurate). The exception is Effect `Data.TaggedError` / service classes whose synthesized `_base` declaration is not source-mapped by rolldown-plugin-dts — those may report a path inside `dist/prod/<id>/declarations/*.d.ts`. In that case, use the symbol name in `text` to find the matching `src/*.ts` declaration.
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 1.3.1 | 1.3.2 |
  | @savvy-web/mcp | dependency | updated | 1.3.1 | 1.3.2 |

## 1.3.1

### Documentation

* [`ce970c8`](https://github.com/savvy-web/systems/commit/ce970c8cf390533aab259294c5be38629964ac23) ### `/silk:tsdoc` and `tsdoctor` — sharper authoring guidance

Three clarifications to the `silk:tsdoc` skill and the `tsdoctor` agent, from a large real-world sweep:

* `@packageDocumentation` belongs only in entry-point files — one per `exports` entry, not one per package (a multi-entry package tags each entry module) — never on a non-entry leaf file.
* Every export carrying `@public` or `@internal` needs a one-line summary, not just the release tag. A bare tag that clears `ae-missing-release-tag` but leaves the block empty is only half the fix.
* Barrel files that re-export values or types are flagged as a documentation footgun. Refactoring the export structure is outside the agent's mechanical loop, so the agent now flags a barrel re-export and asks before changing it rather than reshaping exports unilaterally.

### `/silk:tsdoc` — locate diagnostics by symbol name

The `silk:tsdoc` skill now tells you to find an `ae-*` / `tsdoc-*` diagnostic's declaration by the symbol name quoted in the entry's `text`, not by `file`/`line`. Those location fields are no longer emitted for API Extractor diagnostics because the bundled-`.d.ts` analysis reported them against the wrong file. This matches the paired change in `@savvy-web/tsdown-plugins` that drops the misleading location.

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.3.0 | 1.3.1 |
| @savvy-web/mcp | dependency | updated | 1.3.0 | 1.3.1 |

## 1.3.0

### Features

* [`81f90f3`](https://github.com/savvy-web/systems/commit/81f90f3e6acc11c0b70be856c676292578fdc7c2) ### `/silk:tsdoc` skill

A new `silk:tsdoc` skill is available in the Silk plugin. It provides toolchain-accurate TSDoc authoring guidance tuned for the `@savvy-web/bundler` API Extractor pass, which fails CI on forgotten exports and undefined tags.

The skill covers:

* A quick-fix map for the common `ae-*` and `tsdoc-*` diagnostic codes (`ae-missing-release-tag`, `ae-forgotten-export`, `ae-incompatible-release-tags`, `ae-unresolved-link`, `tsdoc-undefined-tag`, and others)
* Release-tag policy: when to choose `@public`, `@internal`, `@beta`, or `@alpha`
* How to register a custom TSDoc tag in `savvy.build.ts`
* The complete set of supported standard tags
* Common JSDoc habits that break the TSDoc parser (brace-typed `@param`, missing hyphens, `@class`/`@module`)
* Documentation-depth guidance: structuring `@remarks`, `@example`, and prose for the RSPress API Extractor renderer so generated docs display rich narrative sections rather than bare type signatures

The skill auto-loads when editing `savvy.build.ts` and is user-invokable on demand via `/silk:tsdoc`.

### Dependencies

* | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency    | Type    | Action                | From                  | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :-------------------- | :-------------------- | -- |
  | @effect/platform                                                                                  | dependency    | updated | ^0.96.1               | ^0.96.2               |    |
  | effect                                                                                            | dependency    | updated | ^3.21.3               | ^3.21.4               |    |
  | @typescript/native-preview                                                                        | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |    |
  | @types/node                                                                                       | devDependency | updated | ^25.9.0               | ^26.0.0               |    |
  | Dependency                                                                                        | Type          | Action  | From                  | To                    |    |
  | --------------                                                                                    | ----------    | ------- | -----                 | -----                 |    |
  | @savvy-web/mcp                                                                                    | dependency    | updated | 1.2.0                 | 1.3.0                 |    |
  | @savvy-web/cli                                                                                    | dependency    | updated | 1.2.0                 | 1.3.0                 |    |

### `tsdoctor` agent

A new `tsdoctor` agent drives TSDoc diagnostics to zero end-to-end. It builds the target package (prod), reads `dist/prod/issues.json`, applies the `tsdoc` skill's fix recipes for every `ae-*` and `tsdoc-*` diagnostic, and rebuilds to confirm the artifact is clean. The agent does not add `suppressWarnings` entries — suppression is a human escape hatch. Invoke via `/tsdoctor` or by asking Claude to fix TSDoc issues for a package.

### Issues monitor

A new background monitor (`watch-issues`) surfaces `ae-*` and `tsdoc-*` diagnostics from `dist/*/issues.json` as Claude Code notifications during development. The monitor watches for `issues.json` changes written by the build and reports new warnings or errors without requiring a manual log scan.

## 1.2.0

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 1.1.2 | 1.2.0 |
| @savvy-web/cli | dependency | updated | 1.1.2 | 1.2.0 |

## 1.1.2

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.1.1 | 1.1.2 |
| @savvy-web/mcp | dependency | updated | 1.1.1 | 1.1.2 |

## 1.1.1

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.1.0 | 1.1.1 |
| @savvy-web/mcp | dependency | updated | 1.1.0 | 1.1.1 |

## 1.1.0

### Features

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### `savvy lint init` and `savvy commit init` manage a post-commit hook (#122)

`savvy lint init` and `savvy commit init` now create and manage a `.husky/post-commit` hook that restores the executable bit on shell scripts after each commit. This mirrors the existing post-checkout and post-merge hygiene hooks, closing the gap where a commit could strip the execute permission from the very hooks that `post-checkout`/`post-merge` maintained.

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) ### Shipped TSConfig presets

`@savvy-web/silk` now ships two ready-to-use TSConfig presets under the `tsconfig/` export namespace, for projects that follow Silk conventions but do not depend on a Silk build tool at the relevant package:

* `@savvy-web/silk/tsconfig/node/root.json` — a monorepo root that runs under Node.js (`module: nodenext`, `target: es2025`, composite/declaration, `types: ["node"]`). Use it where `@savvy-web/bundler` is not a dependency of the root `package.json`.
* `@savvy-web/silk/tsconfig/rspress/website.json` — a standard RSPress site, aligned with RSPress's official website config (`module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit`, `isolatedModules`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noUnusedLocals`/`noUnusedParameters`, `mdx.checkMdx`, `lib: ["dom", "es2023"]`, react/react-dom types), targeting the browser rather than Node.

Reference either from a package's `tsconfig.json` via `"extends": "@savvy-web/silk/tsconfig/node/root.json"`.

### Bug Fixes

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### Missing `@effect/*` peers no longer crash the `savvy` CLI or `savvy-mcp` server at load (#126)

`@savvy-web/cli` and `@savvy-web/mcp` now declare `@effect/cluster`, `@effect/rpc`, and `@effect/sql` as direct dependencies. The `@effect/platform-node` root barrel eagerly links these clustering submodules at import time. Without these declarations, a fresh install that did not already provide them indirectly would fail with `ERR_MODULE_NOT_FOUND` before any command could run.

### Build System

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) The shipped Biome config (`@savvy-web/silk/biome`) now:

- Excludes `.claude/worktrees` from linting, so nested Claude Code worktrees that carry their own root config no longer trigger Biome's nested-root abort and break the pre-commit hook. Every consumer inherits this automatically rather than re-discovering it.
- Broadens the test-fixtures exclusion to `**/__test__/**/fixtures` (any nesting depth).
- Formats shipped TSConfig presets under `**/public/tsconfig/**/*.json` with the standard tsconfig key-sorting rules.

### Changeset push-guard no longer blocks tag and delete pushes (#124)

The `changeset-push-guard` plugin hook no longer triggers on `git push --tags`, `git push --delete`/`-d`, or refspec-deletion pushes (`git push origin :branch`). These push forms cannot introduce unreleased commits, so blocking them on an unreleased-changeset check was a false positive.

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.0.0 | 1.1.0 |
| @savvy-web/mcp | dependency | updated | 1.0.0 | 1.1.0 |

## 1.0.0

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.5.0 | 1.0.0 |
| @savvy-web/cli | dependency | updated | 0.5.0 | 1.0.0 |

## 0.5.0

### Features

* [`111241c`](https://github.com/savvy-web/systems/commit/111241cefd5d91163871c02d2372a2dfae7cac5c) The silk plugin now integrates Biome two ways. A Biome language server (`biome lsp-proxy`, launched through a global-first resolver that falls back to a project-local install) surfaces lint and format diagnostics automatically after edits across JavaScript, TypeScript, JSON, CSS, and GraphQL files. A new `PreToolUse` hook nudges toward the `biome_check` MCP tool whenever Biome is run via Bash — directly or through a package.json script — without ever blocking the command, so Bash stays a valid escape hatch. A `<biome_capability>` SessionStart block documents the division of labor between the LSP (automatic, read-only), the `biome_check` tool (on-demand, structured, can fix), and Bash.

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.4.2 | 0.5.0 |
| @savvy-web/cli | dependency | updated | 0.4.2 | 0.5.0 |

## 0.4.2

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.4.1 | 0.4.2 |
| @savvy-web/cli | dependency | updated | 0.4.1 | 0.4.2 |

## 0.4.1

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 0.4.0 | 0.4.1 |
| @savvy-web/mcp | dependency | updated | 0.4.0 | 0.4.1 |

## 0.4.0

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) The `./changesets/markdownlint` entry stays dual-format CJS (markdownlint-cli2 `require()`s it) via a per-entry format override.

### Build System

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`. Versioned in lockstep with `@savvy-web/cli` and `@savvy-web/mcp` (fixed release group).

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 0.3.1 | 0.4.0 |
| @savvy-web/mcp | dependency | updated | 0.3.1 | 0.4.0 |

## 0.3.1

### Other

* [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 0.3.0 | 0.3.1 |
  | @savvy-web/mcp | dependency | updated | 0.3.0 | 0.3.1 |

## 0.3.0

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 0.2.1 | 0.3.0 |
| @savvy-web/mcp | dependency | updated | 0.2.1 | 0.3.0 |

## 0.2.1

### Bug Fixes

* [`29ea5bb`](https://github.com/savvy-web/systems/commit/29ea5bb049ba469e5d44282fd1ae8fbf78b78dba) Fixed a portability error in the config-integration shims. Consumer config files that infer a factory's return type — `export default CommitlintConfig.silk()` from `@savvy-web/silk/commitlint`, or `Preset.silk()` / `Preset.minimal()` / `Preset.standard()` / `Preset.get(...)` from `@savvy-web/silk/lint` — failed to type-check under pnpm with TS2883, because the inferred type's canonical home was `@savvy-web/silk-effects`, a transitive dependency the consumer could not name. The shims now wrap these factories in silk-local facades with silk-owned return types, so consumer declaration emit is portable and no type annotation is needed. The public API is unchanged and consumers require no code changes.
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 0.2.0 | 0.2.1 |
  | @savvy-web/mcp | dependency | updated | 0.2.0 | 0.2.1 |

### Documentation

* [`a9ea047`](https://github.com/savvy-web/systems/commit/a9ea04701507a3d5fb290dbaa1eeb3d5f599a67b) Added package READMEs for `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp`. Each covers installation, quick-start usage, and the package's public surface — the `savvy` commands for the CLI, the drop-in config shim export map for silk, and the tool and resource surface for the MCP server. These READMEs ship with each package and render on its npm page.

## 0.2.0

### Features

* [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### Single install target for Silk Suite dev tooling

`@savvy-web/silk` is the unified install package for the Silk Suite. It replaces the previous pattern of installing `@savvy-web/changesets`, `@savvy-web/commitlint`, and `@savvy-web/lint-staged` separately. Config-integration shims re-export the relevant `@savvy-web/silk-effects` logic at drop-in entry points compatible with each toolchain's require/import resolution.

Exported entry points:

* `@savvy-web/silk/changesets` — changeset formatter (default export: `{ getReleaseLine, getDependencyReleaseLine }`)
* `@savvy-web/silk/changesets/changelog` — changelog formatter re-export
* `@savvy-web/silk/changesets/markdownlint` — markdownlint custom rules for changeset validation
* `@savvy-web/silk/changesets/remark` — remark plugins for changelog post-processing
* `@savvy-web/silk/commitlint` — commitlint config factory
* `@savvy-web/silk/commitlint/static` — static commitlint config
* `@savvy-web/silk/commitlint/prompt` — commitizen prompt configuration
* `@savvy-web/silk/commitlint/formatter` — custom commitlint output formatter
* `@savvy-web/silk/lint` — lint-staged configuration factory
* `@savvy-web/silk/biome` — Biome preset JSON asset

```typescript
// commitlint.config.ts
export { default } from "@savvy-web/silk/commitlint";

// .markdownlint-cli2.jsonc
{ "customRules": ["@savvy-web/silk/changesets/markdownlint"] }

// .changeset/config.json
{ "changelog": "@savvy-web/silk/changesets/changelog" }
```

### MCP server integration

The bundled `silk@savvy-web-systems` Claude Code plugin now ships an MCP server entry point. A `start-mcp.sh` launcher wires the plugin into Claude Code's MCP layer, and an `mcp-orientation` session-start hook surfaces relevant context at the start of each session.

### Catalog-first MCP orientation and docs-search skill

The bundled silk Claude Code plugin now steers sessions toward the shared savvy MCP corpus more firmly. The SessionStart orientation hook is strengthened so the agent searches `silk://catalog` and the `silk_docs_search` tool before guessing, reading source, or running grep, and reserves shell workspace commands for git state and cases the `workspace_info` tool does not cover.

A new on-demand docs-search skill documents how to query the corpus well: start at `silk://catalog`, search by concept rather than filename, scope by tier, and read ranked results instead of enumerating the whole corpus. The agent loads it when it needs query technique without paying for it in every session's base context.

### Unified SessionStart hooks and a dogfood-feedback prompt

The plugin's SessionStart hooks are consolidated into two — an always-on `orientation.sh` that persists the session environment and emits the combined orientation, and a `startup-only.sh` that runs the per-session `savvy commit` setup and startup orientation. The session environment variables and the push-guard bypass now use the `SILK_` namespace; set `SILK_SKIP_PUSH_CHECK=1` on a `git push` to bypass the changeset push guard.

Because this is an early release, the orientation now asks the agent to note any rough edges it hits — wrong, unhelpful, or confusing results from a skill, hook, the `savvy` CLI, or an agent — and to surface them at the end of a session. With your explicit agreement, the agent can open an issue in `savvy-web/systems`; it will never file one on its own.

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.1.0 | 0.2.0 |
| @savvy-web/cli | dependency | updated | 0.1.0 | 0.2.0 |

## 0.1.0

### Features

* [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### Single install target for Silk Suite dev tooling

`@savvy-web/silk` is the unified install package for the Silk Suite. It replaces the previous pattern of installing `@savvy-web/changesets`, `@savvy-web/commitlint`, and `@savvy-web/lint-staged` separately. Config-integration shims re-export the relevant `@savvy-web/silk-effects` logic at drop-in entry points compatible with each toolchain's require/import resolution.

Exported entry points:

* `@savvy-web/silk/changesets` — changeset formatter (default export: `{ getReleaseLine, getDependencyReleaseLine }`)
* `@savvy-web/silk/changesets/changelog` — changelog formatter re-export
* `@savvy-web/silk/changesets/markdownlint` — markdownlint custom rules for changeset validation
* `@savvy-web/silk/changesets/remark` — remark plugins for changelog post-processing
* `@savvy-web/silk/commitlint` — commitlint config factory
* `@savvy-web/silk/commitlint/static` — static commitlint config
* `@savvy-web/silk/commitlint/prompt` — commitizen prompt configuration
* `@savvy-web/silk/commitlint/formatter` — custom commitlint output formatter
* `@savvy-web/silk/lint` — lint-staged configuration factory
* `@savvy-web/silk/biome` — Biome preset JSON asset

```typescript
// commitlint.config.ts
export { default } from "@savvy-web/silk/commitlint";

// .markdownlint-cli2.jsonc
{ "customRules": ["@savvy-web/silk/changesets/markdownlint"] }

// .changeset/config.json
{ "changelog": "@savvy-web/silk/changesets/changelog" }
```

### MCP server integration

The bundled `silk@savvy-web-systems` Claude Code plugin now ships an MCP server entry point. A `start-mcp.sh` launcher wires the plugin into Claude Code's MCP layer, and an `mcp-orientation` session-start hook surfaces relevant context at the start of each session.

### Catalog-first MCP orientation and docs-search skill

The bundled silk Claude Code plugin now steers sessions toward the shared savvy MCP corpus more firmly. The SessionStart orientation hook is strengthened so the agent searches `silk://catalog` and the `silk_docs_search` tool before guessing, reading source, or running grep, and reserves shell workspace commands for git state and cases the `workspace_info` tool does not cover.

A new on-demand docs-search skill documents how to query the corpus well: start at `silk://catalog`, search by concept rather than filename, scope by tier, and read ranked results instead of enumerating the whole corpus. The agent loads it when it needs query technique without paying for it in every session's base context.

### Unified SessionStart hooks and a dogfood-feedback prompt

The plugin's SessionStart hooks are consolidated into two — an always-on `orientation.sh` that persists the session environment and emits the combined orientation, and a `startup-only.sh` that runs the per-session `savvy commit` setup and startup orientation. The session environment variables and the push-guard bypass now use the `SILK_` namespace; set `SILK_SKIP_PUSH_CHECK=1` on a `git push` to bypass the changeset push guard.

Because this is an early release, the orientation now asks the agent to note any rough edges it hits — wrong, unhelpful, or confusing results from a skill, hook, the `savvy` CLI, or an agent — and to surface them at the end of a session. With your explicit agreement, the agent can open an issue in `savvy-web/systems`; it will never file one on its own.

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.0.0 | 0.1.0 |
| @savvy-web/cli | dependency | updated | 0.0.0 | 0.1.0 |
