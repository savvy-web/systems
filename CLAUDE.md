# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem by Savvy Web Systems.

## Packages

Each package has its own `CLAUDE.md` (auto-loaded when you work in its subtree) and a design doc under `.claude/design/<pkg>/`.

- **silk-effects** (`@savvy-web/silk-effects`) — shared Effect library and dev-tooling business-logic core (`Changesets`/`Commitlint`/`Lint`/`Turbo`). See `packages/silk-effects/CLAUDE.md`.
- **cli** (`@savvy-web/cli`) — the `savvy` binary (`init`/`check`/`commit`/`changeset`/`lint`/`clean`). See `packages/cli/CLAUDE.md`.
- **mcp** (`@savvy-web/mcp`) — the spawnable `savvy-mcp` server (tools + corpus/API resources). See `packages/mcp/CLAUDE.md`.
- **silk** (`@savvy-web/silk`) — the single install-target of config-integration shims + Biome asset. See `packages/silk/CLAUDE.md`.
- **bundler** (`@savvy-web/bundler`) — the tsdown-based build orchestrator (`defineBuild`/`runBuild`). See `packages/bundler/CLAUDE.md`.
- **tsdown-plugins** (`@savvy-web/tsdown-plugins`) — the interface-only tsdown/rolldown plugin pack the bundler orchestrates. See `packages/tsdown-plugins/CLAUDE.md`.
- **rspress-builder** (`@savvy-web/rspress-builder`) — RSPress plugin builder, a thin sibling to the bundler. See `packages/rspress-builder/CLAUDE.md`.
- **templates** (`@savvy-web/templates`) — pure-function TypeScript project scaffolding. See `packages/templates/CLAUDE.md`.
- **github-action-builder** (`@savvy-web/github-action-builder`) — zero-config rsbuild build tool for Node.js 24 GitHub Actions. See `packages/github-action-builder/CLAUDE.md`.
- **github-action-effects** (`@savvy-web/github-action-effects`) — Effect services replacing `@actions/*`. See `packages/github-action-effects/CLAUDE.md`.

Also in this repo: the Claude Code plugins (`plugins/silk`, `plugins/docs`, `plugins/github-actions`), the placeholder docs site (`docs/`), cross-repo planning, and the plugin marketplace entry point (`.claude-plugin/`).

## Tech Stack

- **Runtime:** Node.js 24.11.0+
- **Package Manager:** pnpm 11.5.1 with `@savvy-web/pnpm-plugin-silk` config dependency
- **Build:** Turborepo orchestration; `@savvy-web/bundler` builds all ten packages (bundler + tsdown-plugins self-host via their escape-hatch `savvy.build.ts`, the other eight via the front-door `defineBuild`/`runBuild`); build scripts run `node savvy.build.ts` (Node 24+ native type-stripping), except `tsdown-plugins` which bootstraps via `tsx`
- **Linting:** Biome, markdownlint
- **Testing:** Vitest via `@savvy-web/vitest`
- **Commits:** Conventional commits with DCO signoff via `@savvy-web/commitlint`
- **Releases:** `@savvy-web/changesets`

## Key Commands

```bash
pnpm build          # Build all packages (dev + prod)
pnpm test           # Run tests
pnpm typecheck      # Type-check all packages
pnpm lint           # Biome check
pnpm lint:fix       # Biome auto-fix
pnpm lint:md        # Markdown lint
```

## Install & Build Orchestration

Build runs on install. A single root `prepare: husky && turbo run build:dev` builds the dev outputs during `pnpm install` (husky runs first so git hooks install even if the build is slow). There are no per-package `prepare` scripts. A fresh clone gets a working `savvy` bin on PATH and functional git hooks immediately. `pnpm build` (turbo `build:dev` + `build:prod`) produces the prod outputs.

Required `pnpm-workspace.yaml` settings: `autoInstallPeers: true`, `verifyDepsBeforeRun: false`. The plugin is pinned in `pnpm-workspace.yaml` WITH its `+sha512-...` integrity hash (turbo/reproducibility need it); `pnpm add --config` omits the hash, so add it by hand. Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts`: injection hard-links each package's `dist/dev` at link time, which is absent before the `prepare` build runs, so a frozen install aborts with `ENOENT`. Plain `link:` symlinks (publishConfig `directory: dist/dev/pkg` for the ten bundler-built packages, + `linkDirectory: true`) tolerate the not-yet-built dir, which the `prepare` build then populates. `@savvy-web/cli` and `@savvy-web/mcp` are direct root devDependencies so they link to `dist/dev`. The `savvy` bin resolves at `dist/dev/pkg/bin/savvy.js`, on PATH after the `prepare` build.

## Ecosystem Context

This repo is the hub of the Silk Suite ecosystem spanning 33 repositories, organized into 7 layers: Foundation Libraries (Effect-based) → Package Management → Build Systems → Developer Experience → CI/CD Pipeline → AI/Agent Tooling → Documentation & Templates.

Key coordination points:

- `@savvy-web/pnpm-plugin-silk` provides version catalogs consumed by all repos
- `@savvy-web/github-action-effects` provides Effect services for all GitHub Actions
- `github-readme-private` (`.github-private`) houses org-level reusable workflows

## Conventions

- Source `package.json` `"private": true` is transformed by builders based on `publishConfig.access`.
- Use `catalog:silk` for pinned dependencies, `catalog:silkPeers` for peer dependency ranges.
- All Effect code uses class-based `Context.Tag`, `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.
- README.md is for external users; `.claude/design/` for package architecture docs.
- The non-import invariant: `@savvy-web/cli`, `@savvy-web/silk`, and `@savvy-web/mcp` must NOT import each other — all three depend only on `@savvy-web/silk-effects` within the repo. (`mcp` also consumes the external `api-extractor-llms` npm package as a build-time devDependency for its API-doc pipeline.)
- `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp` are a `fixed` changeset group (versioned and released together); silk's changeset config carries a `versionFiles` glob that bumps the `plugins/*` manifests in lockstep.
- `@savvy-web/bundler` and `@savvy-web/tsdown-plugins` version independently (changesets auto-bumps the bundler when tsdown-plugins changes; not a fixed group); both self-host while the other eight packages build via the bundler front door.

## Design Documentation

Design docs live in `.claude/design/` (tracked). Per-package design pointers live in each `packages/<pkg>/CLAUDE.md`. These pointers cover topics with no package subtree to auto-load from:

**`plugins/silk` — the merged Claude Code plugin:**
→ `@./.claude/design/silk/plugin.md`
Load when working on `plugins/silk` (skills, agents, hooks, MCP wiring).

**`plugins/docs` — the corpus-documentation Claude Code plugin:**
→ `@./.claude/design/docs/architecture.md`
Load when working on `plugins/docs` (the `mcp` corpus agent, capability skills, mode commands).

**`api-extractor-llms` — API Extractor model → LLM-markdown renderer (external npm package, own repo):**
→ `@./.claude/design/api-extractor-llms/architecture.md`
Load when working on the mcp API-doc generation pipeline.
