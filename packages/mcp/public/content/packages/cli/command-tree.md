---
id: packages/cli/command-tree
title: The savvy command tree
summary: Load to orient on what the savvy binary does and how its command groups are organized.
tier: packages
source: hand
tags: [cli]
priority: 0.5
related: [packages/cli/init-and-check, packages/silk/install-and-setup]
---

## What

`@savvy-web/cli` owns the `savvy` binary — the single command host for the Silk
Suite's everyday dev tooling, built on `@effect/cli` + `@effect/platform-node`. It
carries no business logic of its own: every handler imports its work from
`@savvy-web/silk-effects`. The binary replaces three standalone bins
(`savvy-changesets`, `savvy-commit`, `savvy-lint`) with one. It is a `fixed`
changeset group with `@savvy-web/silk` — they always release together.

## API

The tree is static — no runtime discovery, no contribution manifest, no per-command
"is the system configured" gate. Commands assume the system is set up (`savvy init`
sets it up).

```text
savvy init        orchestrator → changeset · commit · lint init in one pass
savvy check       orchestrator → runs all three checks
savvy commit      hook(session-start · pre-commit-message · post-commit-verify)
savvy changeset   lint · check · transform · validate-file · version ·
                  config(validate) · deps(detect · regen)
savvy lint        fmt(package-json · pnpm-workspace · yaml)
```

Each group lives under `src/commands/{commit,changeset,lint}/` and exports its
group command plus named handlers (e.g. `runChangesetInit`). The top-level `init`
and `check` orchestrators sequence the three tool handlers and short-circuit on
first failure; the tool handlers are injected so the orchestration logic is
unit-testable without a runtime. The plugin hooks and skills shell out to these
subcommands.

## Layer

The runtime layer stack is assembled once in `runCli()` (`src/cli/index.ts`) as the
union of the three source CLIs' stacks. It uses `provideMerge` (not `provide`) so
base silk-effects services are both fed to upper services and re-exposed for
handlers that yield those tags directly, and it hand-wires a minimal workspace
trio (`WorkspaceRoot`, `WorkspaceDiscovery`, `PackageManagerDetector`) rather than
the heavier `WorkspacesLive`.

Because the command groups are typed with an `any` R-channel (an Effect/cli
declaration-emit escape hatch), the type-checker cannot prove `AppLive` supplies
every required service. The real layer-completeness gate is the **runtime smoke
tests** that run each command, not `tsgo`. Treat them as the contract when adding a
command that needs a new service.

## Usage

The `savvy` bin resolves to `src/bin/cli.ts` → `runCli()`. Tools it shells out to
(`@biomejs/biome`, `husky`, `@commitlint/*`, `@changesets/cli`, `lint-staged`,
`markdownlint-cli2`) are not direct deps; `@savvy-web/silk` co-installs them as
peers and pnpm's public-hoist-pattern makes them resolvable.

## Related

Init and check: `silk://packages/cli/init-and-check`. Install surface:
`silk://packages/silk/install-and-setup`.
