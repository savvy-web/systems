# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem by Savvy Web Systems.

## Repository Purpose

- **silk-effects** — shared Effect library; also hosts the dev-tooling business logic under three namespace exports (`Changesets`, `Commitlint`, `Lint`); dual-format esm+cjs (implemented)
- **cli** — `@savvy-web/cli`, the `savvy` binary with `init`/`check`/`commit`/`changeset`/`lint` commands; replaces the three old per-tool bins (implemented)
- **silk** — `@savvy-web/silk`, the single install-target of thin config-integration shims plus the biome asset (implemented)
- **plugins/silk** — merged Claude Code plugin (`silk@savvy-web-systems`): 13 skills, the `changeset-manager` agent, merged hooks (implemented)
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

Load when working on templates, adding new templates, or understanding the
pure-function content generation approach. Covers all 10 templates, Effect
Schema validation, TemplateEntry abstraction, and workspace compositor.

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

Load when working on `@savvy-web/silk`. Covers the drop-in shim contract, the export map, the dual-format-for-CJS requirement, peerDep wiring, and the consumer model.

**plugins/silk — the merged Claude Code plugin:**
→ `@./.claude/design/silk/plugin.md`

Load when working on `plugins/silk`. Covers the skill/agent/hook merge, the tool-prefixed-vs-unprefixed skill naming scheme, and the hooks repointed at the unified `savvy` bin.

Silk Core sub-project 1 design: `@./docs/superpowers/specs/2026-05-30-silk-subproject-1-merge-design.md`

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
- `@savvy-web/cli` and `@savvy-web/silk` must NOT import each other (the cli↔silk non-import invariant) — see `@./.claude/design/cli/architecture.md`
- `@savvy-web/silk` and `@savvy-web/cli` are a `fixed` changeset group (versioned and released together); silk ships dual-format esm+cjs for its CJS consumers
