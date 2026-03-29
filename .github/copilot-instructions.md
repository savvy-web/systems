# Copilot Coding Agent Instructions

## Repository Overview

This is the **Silk Suite Systems** coordination hub (`savvy-web/systems`) for the Silk Suite
open-source ecosystem maintained by Savvy Web Systems.

**Key Characteristics:**

* **Type:** Monorepo coordination hub with planned packages
* **Languages:** TypeScript, YAML configuration
* **Package Manager:** pnpm 10.33.0 with `@savvy-web/pnpm-plugin-silk` config dependency
* **Node.js Version:** 24.11.0 (specified in devEngines)
* **Build System:** Turborepo orchestration, `@savvy-web/rslib-builder` for packages

## Planned Packages

This repo will contain three packages (currently in design phase):

* `@savvy-web/silk-effects` -- shared Effect library for Silk Suite conventions
* `@savvy-web/templates` -- Effect-based project scaffolding
* `@savvy-web/cli` -- workspace management CLI (`savvy` binary)

## Development Commands

| Command | Description |
| --- | --- |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Run Biome checks |
| `pnpm lint:fix` | Run Biome with auto-fix |
| `pnpm lint:md` | Lint markdown files |

## Code Quality Standards

* **Formatter:** Biome -- tabs, no trailing commas
* **TypeScript:** Strict mode, ES modules with `.js` extensions required
* **Testing:** Vitest via `@savvy-web/vitest`
* **Commits:** Conventional Commits with DCO signoff via `@savvy-web/commitlint`
* **Imports:** Use `node:` protocol for Node.js built-ins; separate type imports

## Effect-TS Conventions

All Effect code in this repo uses:

* Class-based `Context.Tag` for services
* `Schema.Class` / `Schema.TaggedClass` for data types
* `Data.TaggedError` for typed errors
* `@effect/platform` abstractions for I/O (platform-agnostic)
