# Silk Suite Systems

Coordination hub and shared libraries for the [Silk Suite](https://github.com/orgs/savvy-web/projects/1) open-source ecosystem, maintained by [Savvy Web Systems](https://savvyweb.systems).

## Packages

### @savvy-web/silk-effects

Shared [Effect](https://effect.website/) library providing Silk Suite conventions. Platform-agnostic -- consumers provide their own runtime layer.

| Topic | What it does |
| ----- | ------------ |
| [Overview](./packages/silk-effects/docs/01-overview.md) | What the library is, its design philosophy and platform-layer model |
| [Platform layers](./packages/silk-effects/docs/02-platform-layers.md) | Composing layers and providing platform dependencies |
| [Publishability](./packages/silk-effects/docs/03-publishability.md) | Multi-registry target resolution and publishability detection |
| [Changeset config](./packages/silk-effects/docs/04-changeset-config.md) | Reading and decoding `.changeset/config.json` with Silk detection |
| [Config discovery](./packages/silk-effects/docs/05-config-discovery.md) | Config file discovery with `lib/configs/` priority convention |
| [Biome sync](./packages/silk-effects/docs/06-biome-sync.md) | Biome `$schema` URL synchronization across config files |

```bash
npm install @savvy-web/silk-effects effect @effect/platform-node
# or
pnpm add @savvy-web/silk-effects effect @effect/platform-node
```

See the [silk-effects README](./packages/silk-effects/README.md) for usage examples.

### @savvy-web/silk

The single package a consumer installs to get the whole Silk Suite dev-tooling system: drop-in config entry points for changesets, commitlint and lint-staged, a Biome preset and — through its peers — the `savvy` CLI.

See the [silk README](./packages/silk/README.md) for the config entry points and export map.

### @savvy-web/cli

The `savvy` binary: one command to set up changeset, commit and lint conventions in a Silk Suite project, check them and run the git hooks behind them.

See the [cli README](./packages/cli/README.md) for the command reference.

### @savvy-web/mcp

The `savvy-mcp` Model Context Protocol server, serving Silk Suite tooling to coding agents as structured tools so an agent can read workspace facts and run Silk checks instead of parsing console output. Tools-only — no resources.

See the [mcp README](./packages/mcp/README.md) for the tool surface.

### @savvy-web/changelog

The [changesets](https://github.com/changesets/changesets) changelog generator as a standalone package — the canonical `changelog` id for `.changeset/config.json`, shipped as ESM, which the changesets CLI `import()`s. Installed automatically as a dependency of `@savvy-web/silk`.

See the [changelog README](./packages/changelog/README.md) for the config entry.

### @savvy-web/templates

Pure TypeScript templates for Silk Suite project scaffolding. Each template takes typed options (validated with [Effect](https://effect.website/) Schema) and returns `TemplateEntry[]` — a list of `{ name, filename, content }` records. No filesystem calls; you decide where and how to write the output.

See the [templates README](./packages/templates/README.md) for usage examples.

### @savvy-web/pnpm-plugin-silk

Centralized dependency-version management for the Silk ecosystem, delivered as a pnpm config dependency: the `build`, `docs`, `lint`, `silk` and `test` catalogs with their `:peers` companions, plus security overrides and install-time policy shared across every consuming repository.

See the [pnpm-plugin-silk README](./packages/pnpm-plugin-silk/README.md) for the catalog reference and install steps.

## Claude Code plugin marketplace

Silk Suite includes a plugin marketplace for [Claude Code](https://docs.anthropic.com/en/docs/claude-code):

```bash
claude plugin add marketplace savvy-web/systems
```

**Available plugins:**

- **silk** -- Companion for `@savvy-web/silk`: changeset, commit, lint and Turborepo conventions, skills and agents, the bundled `savvy-mcp` server and live Biome diagnostics

### Biome in the silk plugin

The silk plugin runs the Biome language server (`biome lsp-proxy`), so Biome lint and format diagnostics surface automatically while you work across JavaScript, TypeScript, JSON, CSS and GraphQL files. Biome must be available for the language server to start: install it globally on PATH (recommended -- `brew install biome` or `npm i -g @biomejs/biome`) or add it as a project devDependency so `node_modules/.bin/biome` resolves. Without Biome the language server exits with an actionable message telling you to install it, surfaced in the `/plugin` Errors tab.

For on-demand checks the bundled `savvy-mcp` server exposes the `biome_check` tool: run Biome over any path and get structured diagnostics back, optionally applying fixes with `write` (safe) or `unsafe`. It complements the always-on LSP, which is read-only. Running Biome through Bash still works and draws a one-time, non-blocking nudge toward `biome_check`.

## Ecosystem

Silk Suite spans 30+ packages across the `@savvy-web` npm scope.

### Build systems

- [@savvy-web/rslib-builder](https://github.com/savvy-web/rslib-builder) -- TypeScript library builder using RSlib/Rsbuild with auto entry detection
- [@savvy-web/bun-builder](https://github.com/savvy-web/bun-builder) -- Bun-native builder with lifecycle-phase architecture

### Developer experience

- [@savvy-web/lint-staged](https://github.com/savvy-web/lint-staged) -- Composable pre-commit handlers (Biome, markdown, TypeScript, YAML)
- [@savvy-web/commitlint](https://github.com/savvy-web/commitlint) -- Dynamic commitlint configuration with auto-detection
- [@savvy-web/vitest](https://github.com/savvy-web/vitest) -- Zero-config monorepo test discovery and coverage presets
- [@savvy-web/changesets](https://github.com/savvy-web/changesets) -- Structured changelog formatting with 13-category sections

### CI/CD pipeline

- [silk-router-action](https://github.com/savvy-web/silk-router-action) -- Release pipeline entry point: phase detection and release plan computation
- [silk-release-action](https://github.com/savvy-web/silk-release-action) -- Release engine: branch management, validation, multi-registry publishing
- [silk-runtime-action](https://github.com/savvy-web/silk-runtime-action) -- Runtime setup from `devEngines` with smart caching
- [silk-sync-action](https://github.com/savvy-web/silk-sync-action) -- Organization-wide repo settings and label synchronization

### Templates

- [pnpm-module-template](https://github.com/savvy-web/pnpm-module-template) -- Single package starter with full Silk Suite integration
- [pnpm-monorepo-template](https://github.com/savvy-web/pnpm-monorepo-template) -- Multi-package monorepo scaffold
- [github-action-template](https://github.com/savvy-web/github-action-template) -- Node.js 24 GitHub Action starter on the `@effected` kit (`@effected/github-actions`)

## Requirements

- Node.js 24.11.0+
- pnpm 11+

## License

[MIT](LICENSE)
