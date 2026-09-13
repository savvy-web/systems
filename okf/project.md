---
type: Project
title: systems
description: The Silk Suite coordination hub — the monorepo that hosts the Silk Suite's packages, plugin, and release tooling.
status: draft
tags: [architecture]
sources:
  - id: claude-md
    resource: ../CLAUDE.md
  - id: design-config
    resource: ../package.json
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 51b7b2c3e145b48c5ea6f900fa7a7b99b0a75a8fdedfe3c13f99ac38cd4a2155
---

# systems

## Purpose

`savvy-web/systems` (repository name `systems`, published packages under the `@savvy-web/` scope) is the coordination hub for the Silk Suite open-source ecosystem: a pnpm/Turborepo monorepo that builds, tests, lints, and releases the Silk Suite's dev-tooling packages, its Claude Code plugin, and its shared build infrastructure, so that the ecosystem's own tools are developed with the same tools they ship to consumers.[^claude-md]

## Boundaries

This project owns twelve published npm packages forming a strict layered graph — L4 [`silk`](modules/silk.md) → L3 [`cli`](modules/cli.md)/[`mcp`](modules/mcp.md)/`changelog` → L2 [`silk-effects`](modules/silk-effects.md) → L1 [`silk-core`](modules/silk-core.md) — plus `bundler`, `tsdown-plugins`, `rspress-builder`, `templates`, `github-action-builder`, and `pnpm-plugin-silk`, each under `packages/*` with its own `CLAUDE.md` and design doc.[^claude-md] It also owns `e2e/*`, a separate harness of private, test-only packages that exercise built `dist/dev` artifacts against isolated fixtures, and `plugins/silk`, the repository's one Claude Code plugin (bundling the `savvy`/`savvy-mcp` bins' MCP wiring, hooks, and skills).[^claude-md] It owns the shared Effect v4 toolchain conventions, the pnpm catalog strategy, and the Turborepo build orchestration that ties all of the above together.[^claude-md]

## Non-goals

- **Cross-repo, ecosystem-level planning.** The 7-layer, 33-repository map, org-level GitHub access patterns, and the release-pipeline migration plan live in the private `savvy-web/company` repository, not here — this repository is public.[^design-config]
- **`@savvy-web/github-action-effects`.** Deleted; savvy-specific GitHub Action logic routes through [`silk-effects`](modules/silk-effects.md) instead, and the GitHub Actions themselves consume `@effected/github-actions` directly.[^claude-md]
- **`plugins/github-actions`.** Removed; `plugins/silk` is the repository's only Claude Code plugin.[^claude-md]
- **The placeholder `docs/` site.** Present in the repository tree but out of scope for this project's active surface.[^claude-md]

[^claude-md]: ../CLAUDE.md
[^design-config]: `../package.json`
