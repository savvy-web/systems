# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem by Savvy Web Systems.

## Repository Purpose

- **silk-effects** — shared Effect library; also hosts the dev-tooling business logic under three namespace exports (`Changesets`, `Commitlint`, `Lint`); dual-format esm+cjs (implemented)
- **cli** — `@savvy-web/cli`, the `savvy` binary with `init`/`check`/`commit`/`changeset`/`lint`/`clean` commands; `savvy init`/`savvy check` are the sole setup/validation entry points (the per-tool init/check subcommands were removed from the changeset/commit/lint groups); replaces the three old per-tool bins (implemented)
- **silk** — `@savvy-web/silk`, the single install-target of thin config-integration shims plus the biome asset (implemented)
- **mcp** — `@savvy-web/mcp`, the spawnable `savvy-mcp` server exposing the `workspace_info` and `silk_docs_search` tools plus a manifest-backed resource layer (`silk://catalog` plus a `silk://{+path}` template over a compiled markdown corpus) over silk-effects; Phase B adds per-package API-reference docs (`silk://packages/<pkg>/api/*`) generated from API Extractor models via the external `api-extractor-llms` npm package, body-content search, a related-graph see-also boost, and query logging; a standalone server, not a discovery host (implemented)
- **plugins/silk** — merged Claude Code plugin (`silk@savvy-web-systems`): 13 skills, the `changeset-manager` agent, merged hooks, plus `savvy-mcp` wiring (implemented)
- **plugins/docs** — `docs@savvy-web-systems` plugin holding the `mcp` corpus-documentation agent (authors/improves docs in the savvy MCP corpus), two capability skills (`corpus-authoring`, `corpus-verify`), and two mode commands (`/docs:write-guide`, `/docs:improve`); spawns the shared `savvy-mcp` server; its version maps to `@savvy-web/mcp` (implemented)
- **plugins/github-actions** — Claude Code plugin spawning the shared `savvy-mcp` server, with a TIER-1/2 SessionStart orientation hook and full hook libs that direct agents to the shared savvy MCP; no actions-specific tools/resources yet (future) (implemented)
- **templates** — pure TypeScript project scaffolding (implemented)
- **github-action-builder** — zero-config rsbuild build tool for Node.js 24 GitHub Actions (implemented)
- **github-action-effects** — Effect-based library replacing @actions/* with 37 schema-validated services (implemented)
- Public documentation site (docs/ — placeholder for future RSPress site)
- Cross-repo planning and coordination
- Claude Code plugin marketplace entry point (.claude-plugin/)

## Tech Stack

- **Runtime:** Node.js 24.11.0+
- **Package Manager:** pnpm 10.33.0 with @savvy-web/pnpm-plugin-silk config dependency
- **Build:** Turborepo orchestration, @savvy-web/rslib-builder for packages
- **Linting:** Biome, markdownlint
- **Testing:** Vitest via @savvy-web/vitest
- **Commits:** Conventional commits with DCO signoff via @savvy-web/commitlint
- **Releases:** @savvy-web/changesets

## Key Commands

```bash
pnpm build          # Build all packages (dev + prod)
pnpm test           # Run tests
pnpm typecheck      # Type-check all packages
pnpm lint           # Biome check
pnpm lint:fix       # Biome auto-fix
pnpm lint:md        # Markdown lint
```

## Design Documentation

Design docs live in `.claude/design/` (tracked):

**silk-effects architecture, service patterns, and consumer guide:**
→ `@./.claude/design/silk-effects/architecture.md`

Load when working on silk-effects, implementing new services, or onboarding consumer repos. Covers role-based folder layout, single root export, all 10 services, value object patterns, the v0.2.0 ManagedSection + ToolDiscovery redesigns, ManagedSection's `syncMany`/`remove` multi-section primitives plus the `SavvySections` shared husky-hook shells (both `@since 0.5.0`), and the SilkWorkspaceAnalyzer composite service.

**templates architecture, template inventory, and design decisions:**
→ `@./.claude/design/templates/architecture.md`

Load when working on templates, adding new templates, or understanding the pure-function content generation approach. Covers all 10 templates, Effect Schema validation, TemplateEntry abstraction, and workspace compositor.

**github-action-effects services, layers, errors, and integration points:**
→ `@./.claude/design/github-action-effects/index.md`

Load when working on github-action-effects or building GitHub Actions on its Effect services. Indexes the 37 services, layer composition, error/schema definitions, integration points, and testing strategy across six docs.

**github-action-builder architecture and build pipeline:**
→ `@./.claude/design/github-action-builder/architecture.md`

Load when working on github-action-builder or configuring action builds. Covers the zero-config rsbuild pipeline targeting Node.js 24 GitHub Actions.

**@savvy-web/cli architecture — the `savvy` binary and runtime layer stack:**
→ `@./.claude/design/cli/architecture.md`

Load when working on the `savvy` CLI. Covers the static command tree, the merged runtime layer stack assembled in `src/cli/index.ts`, the runtime-smoke-test layer-completeness gate (vs tsgo), and the cli↔silk non-import invariant.

**@savvy-web/silk architecture — the config-integration shim surface and Biome asset:**
→ `@./.claude/design/silk/architecture.md`

Load when working on `@savvy-web/silk`. Covers the drop-in shim contract, the export map, the dual-format-for-CJS requirement, peerDep wiring, the consumer model, and the type-portability invariant (silk-local facades over the `CommitlintConfig`/`Preset` factories so consumer configs emit portable `.d.ts` and avoid TS2883).

**plugins/silk — the merged Claude Code plugin:**
→ `@./.claude/design/silk/plugin.md`

Load when working on `plugins/silk`. Covers the skill/agent/hook merge, the tool-prefixed-vs-unprefixed skill naming scheme, and the hooks repointed at the unified `savvy` bin.

**plugins/docs — the corpus-documentation Claude Code plugin:**
→ `@./.claude/design/docs/architecture.md`

Load when working on `plugins/docs`. Covers the `mcp` corpus-documentation agent, the `corpus-authoring`/`corpus-verify` capability skills, the `/docs:write-guide` and `/docs:improve` mode commands, the SessionStart orientation hook, and the `savvy-mcp` wiring whose version maps to `@savvy-web/mcp`. (Path may need adjustment if the design-doc agent uses a different filename.)

**@savvy-web/mcp architecture — the `savvy-mcp` server, its runtime layer, tool half, and resource half:**
→ `@./.claude/design/mcp/architecture.md`

Load when working on the MCP host. Covers the standalone (non-discovery) server, the information-in-mcp/direction-in-plugins split, the `ManagedRuntime` over silk-effects, the `workspace_info` tool with its Effect-Schema→zod bridge, the `silk_docs_search` tool over an in-memory Fuse `DocIndex`, the build-time catalog compiler that emits the tracked `manifest.json` (shape `{ entries }`, a deterministic function of content) from the markdown corpus behind a deep-equality write guard, the `silk://catalog` + `silk://{+path}` resource layer rendered from that manifest, the Phase B generated API-doc tier (`silk://packages/<pkg>/api/*`) driven by the external `api-extractor-llms` npm package whose rendered markdown is tracked source content and ships in the tarball (only the `.api.json` model files under `packages/mcp/lib/models/` stay gitignored), body-content search, see-also boost, query logging, and the three-plugin (`silk`, `github-actions`, `docs`) integration.

**api-extractor-llms — API Extractor model → LLM-markdown rendering library (extracted to a standalone repo):**
→ `@./.claude/design/api-extractor-llms/architecture.md`

Load when working on the mcp API-doc generation pipeline. The renderer now ships as the external unscoped npm package `api-extractor-llms` (its own repo, `spencerbeggs/api-extractor-llms`); mcp consumes it as a build-time devDependency. This doc covers the single output system, the injectable FrontmatterRenderer + RouteFormatter, the extraction/formatter/cross-linker modules, and the boundaries.

Silk Suite roadmap and remaining 0.1.0 work (plan of record): `@./docs/superpowers/specs/2026-06-01-silk-suite-0.1.0-closeout-and-roadmap.md`

## Ecosystem Context

This repo is the hub of the Silk Suite ecosystem spanning 33 repositories. The ecosystem is organized
into 7 layers: Foundation Libraries (Effect-based) → Package Management → Build Systems → Developer
Experience → CI/CD Pipeline → AI/Agent Tooling → Documentation & Templates.

Key coordination points:

- `@savvy-web/pnpm-plugin-silk` provides version catalogs consumed by all repos
- `@savvy-web/github-action-effects` provides Effect services for all GitHub Actions
- `github-readme-private` (.github-private) houses org-level reusable workflows
- Rebrand from "Workflow" to "Silk Suite" complete

## Conventions

- Source package.json `"private": true` is transformed by builders based on publishConfig.access
- Use `catalog:silk` for pinned dependencies, `catalog:silkPeers` for peer dependency ranges
- All Effect code uses class-based `Context.Tag`, `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`
- README.md is for external users; .claude/design/ for package architecture docs
- `@savvy-web/cli` and `@savvy-web/silk` must NOT import each other (the cli↔silk non-import invariant); `@savvy-web/mcp` imports neither cli nor silk — all three depend only on silk-effects within the repo (the cli↔silk↔mcp non-import invariant) — see `@./.claude/design/cli/architecture.md` and `@./.claude/design/mcp/architecture.md`; mcp depends on the external unscoped npm package `api-extractor-llms` as a build-time devDependency for its API-doc pipeline; that build chain runs via turbo: the four in-monorepo library targets' `build:prod` → mcp `generate:api-docs` (using `api-extractor-llms`) → `build:catalog` → mcp `build`
- `@savvy-web/silk` and `@savvy-web/cli` are a `fixed` changeset group (versioned and released together); silk ships dual-format esm+cjs for its CJS consumers; `@savvy-web/mcp` versions independently and also drives the `plugins/docs` plugin's version file
