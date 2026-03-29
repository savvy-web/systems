# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem by Savvy Web Systems.

## Repository Purpose

- **silk-effects** — shared Effect library (implemented), **templates** and **cli** (planned)
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

Load when working on silk-effects, implementing new services, or onboarding
consumer repos. Covers role-based folder layout, single root export, all 9
services, value object patterns, and the v0.2.0 ManagedSection + ToolDiscovery
redesigns.

Planned: `templates/architecture.md`, `cli/architecture.md`

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
