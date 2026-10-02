---
type: Decision
title: The savvy CLI carries ink and react as regular dependencies, loaded only to draw
description: "@savvy-web/cli declares ink and react — optional peers of @effected/cli — as regular dependencies, so every install of the cli (and of @savvy-web/silk, which pins it) carries ink, react and yoga-layout, while each screen module is imported lazily and only a person at a terminal ever loads them."
status: draft
tags: [deps, architecture, performance]
generated:
  by: okfit/claude-code
  at: 2026-10-02T01:43:20Z
  body_sha256: 1b93e9b7228601d9e9be2d3f0c70c4d318bdef87017710c70e04f925abe6cb1f
sources:
  - id: cli-manifest
    resource: ../../packages/cli/package.json
  - id: confirm
    resource: ../../packages/cli/src/internal/confirm.ts
  - id: clean
    resource: ../../packages/cli/src/commands/clean.ts
  - id: plugin-silk-build
    resource: ../../packages/pnpm-plugin-silk/savvy.build.ts
---

# The savvy CLI carries ink and react as regular dependencies, loaded only to draw

## Context

The `feat/interactive-cli` work moved `savvy`'s prompts, confirmations and live progress views onto `@effected/cli/ui`, the kit's Ink-based screen layer. `@effected/cli` 0.11 declares `ink`, `react` and `@types/react` as *optional* peer dependencies: a consumer that never draws a screen need not install them, and one that does must supply them itself.[^cli-manifest]

`@savvy-web/cli` already seals its Effect closure as regular `dependencies` with no `peerDependencies` block, the posture shared with mcp and tsdown-plugins, and `@savvy-web/silk` pins cli as an exact regular dependency — see [silk-pins-siblings-as-dependencies](silk-pins-siblings-as-dependencies.md). Whatever cli depends on, every silk install carries.

## Decision

Declare `ink` and `react` as regular `dependencies` of `@savvy-web/cli`, spelled `catalog:silk` (with `ink` added to the `silk` catalog in `@savvy-web/pnpm-plugin-silk`), and `@types/react` as a devDependency. Every install of cli, and therefore of silk, carries `ink`, `react` and ink's own `react-reconciler` and `yoga-layout`.[^cli-manifest][^plugin-silk-build]

The weight is paid on disk, not at run time. A screen lives in its own `.tsx` module and is mounted through `CliUi.lazy(() => import(...))`. No command module imports `ink` or `react`, so the dynamic import runs only on the path that draws: a person at a terminal. An agent, CI, or a pipe answers every prompt from its non-interactive fallback without loading React — `confirmDestructive` returns before any screen is built, and `savvy clean` takes its plain path.[^confirm][^clean]

## Alternatives rejected

- **Leave them as optional peers.** This would have matched the kit's own declaration, but a `savvy` installed through silk would then reach its first prompt with no `ink` to import and fail at run time. It would also put the cli back on peer resolution, which the sealed-closure posture exists to avoid.
- **Keep the CLI non-interactive.** This avoids the dependency entirely, but leaves a person typing a missing repo name from memory and destructive commands with no confirmation step.
- **Split the screens into a separate optional package.** This would have kept the weight off agent and CI installs at the cost of another published package and a second carrier edge, for screens that are small and already loaded lazily.

## Consequences

- Every silk and cli install is heavier by ink, react, react-reconciler and yoga-layout, even where no one ever draws a screen.
- Process start-up does not grow: nothing on a non-interactive path imports the screen modules.
- An `ink` or `react` major bump is now a cli dependency bump, managed through the `silk` catalog like any other.
- A new screen must stay behind `CliUi.lazy`. A static `ink`/`react` import in a command module would load React on every run.

[^cli-manifest]: `../../packages/cli/package.json`
[^confirm]: `../../packages/cli/src/internal/confirm.ts`
[^clean]: `../../packages/cli/src/commands/clean.ts`
[^plugin-silk-build]: `../../packages/pnpm-plugin-silk/savvy.build.ts`
