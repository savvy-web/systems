# @savvy-web/silk

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
