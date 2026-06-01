---
id: packages/cli/init-and-check
title: savvy init and check
summary: Load when running or wiring the savvy init/check orchestrators.
tier: packages
source: hand
tags: [cli, init]
priority: 0.5
related: [packages/cli/command-tree, packages/silk/install-and-setup]
---

## What

`savvy init` and `savvy check` are the top-level orchestrators of the `savvy`
command tree. `init` is what sets the system up — it runs the changeset, commit,
and lint `init` handlers in one pass, seeding configs and wiring husky hooks.
`check` runs all three checks. The rest of the tree (`commit`, `changeset`, `lint`)
assumes `init` has already run.

## API

Both orchestrators sequence the three per-tool handlers and short-circuit on the
first failure. They live at `src/commands/init.ts` and `src/commands/check.ts`. The
per-tool handlers are injected rather than imported inline, so the orchestration
logic — the sequencing and short-circuit — is unit-testable without standing up the
full runtime. Per-tool `init` and `check` stay reachable under their namespaces
(`savvy changeset init`, `savvy lint check`, and so on).

## Layer

`init` and `check` run on the same merged runtime stack as the rest of the tree,
assembled once in `runCli()`. Because they orchestrate the same handlers the plugin
hooks call, they are covered by the runtime smoke tests that gate layer
completeness.

## Usage

```bash
savvy init     # seed configs + wire husky hooks for changesets, commitlint, lint-staged
savvy check    # run the changeset, commit, and lint checks; fail on the first violation
```

`savvy init` is what a consumer runs after installing `@savvy-web/silk`: the
install pulls the `savvy` bin and the real tools as peers, then `init` seeds the
configs that reference `@savvy-web/silk/*` and points the husky hooks at `savvy`
subcommands.

## Related

The full command tree: `silk://packages/cli/command-tree`. The install flow that
precedes `init`: `silk://packages/silk/install-and-setup`.
