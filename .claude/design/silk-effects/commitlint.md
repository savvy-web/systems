---
module: silk-effects
category: architecture
status: current
completeness: 85
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./architecture.md
  - ./issue-references.md
  - ./hook-sections.md
  - ../cli/architecture.md
  - ../silk/plugin.md
---

# Commitlint namespace

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Topology](#topology)
- [The hook rules are a menu](#the-hook-rules-are-a-menu)
- [Coupling to the plugin's commit format](#coupling-to-the-plugins-commit-format)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`Commitlint` (`src/commitlint/`, `export * as Commitlint`) holds the business logic of the former `@savvy-web/commitlint` package: the config factory and its custom `silk/*` rules, DCO and scope detection, the formatter, the commitizen prompt adapter and the Claude Code hook logic that `savvy commit hook` runs over an agent's `git commit`/`gh pr` invocations.

## Current state

Implemented and consumed by `@savvy-web/cli` (`savvy commit …`) and `@savvy-web/silk` (the `commitlint` config shim). `CommitlintUserConfig` and its type closure are flat-exported from the package root for declaration emit (see [Export surface](./architecture.md#export-surface)).

## Topology

`src/commitlint/index.ts` is the authoritative listing. `config/` builds the commitlint configuration (`createConfig`, the `silk/*` plugin rules, `staticConfig`); `detection/` reads DCO and scope hints from the repo; `formatter/` renders lint outcomes with explanations and suggestions; `prompt/` adapts the commitizen prompter; `hook/` holds the Claude Code hook envelopes, the bash-command parser and the rule set under `hook/rules/`.

Which `silk/*` rules `createConfig` actually enables is decided in `config/factory.ts` — check it before claiming a rule is enforced (`silk/body-prose-only` exists but is not enabled by default, so dash bullets are legal).

## The hook rules are a menu

Each rule under `hook/rules/` is an independent `Rule` with its own severity; nothing in this package composes them into a fixed pipeline. The `savvy commit hook pre-commit-message` caller runs the commit-body rules for a real commit message and a smaller set for a `gh pr create`/`pr edit` body (`../cli/architecture.md`). A new rule therefore has to be classified by the caller, and a rule that assumes it is only ever handed a commit message needs to say so.

`closes-trailer` matches the whole reference list on a trailer line — `Closes #247, #248, #251` is one line naming three issues, the form the commit format asks for — through the kit's `parseClosingLists`. It is strictly whole-line: a keyword mid-prose does not satisfy it, deliberately, and all nine GitHub closing tenses count. See [Issue references](./issue-references.md).

## Coupling to the plugin's commit format

`verbosity`'s exported `VERBOSITY_LINE_THRESHOLD`/`VERBOSITY_WORD_THRESHOLD` encode the plugin's authored commit shape, not a generic style opinion: they are sized to the few-bullet house format the `commit-create` skill teaches, plus headroom, because this repo squash-merges and a long body is discarded at merge. Changing the format in `plugins/silk/skills/commit-create/SKILL.md` without moving the constants (or the reverse) puts the advisory rule and the authoring instruction into disagreement — the one coupling between this package and the plugin's prose (`../silk/plugin.md`).

## Rationale

### Why the rules are not a pipeline

The hook inspects two document kinds — commit messages and PR bodies — with different contracts (a PR body is markdown and may carry headers and fences; a commit body may not). Keeping rules independent lets the caller pick the subset per kind instead of encoding both contracts in one run.

## Related documentation

- [Architecture overview](./architecture.md)
- [Issue references](./issue-references.md) — the grammar behind `closes-trailer`
- [Shared hook sections](./hook-sections.md) — the `SAVVY-COMMIT` husky section the CLI installs
- [`../cli/architecture.md`](../cli/architecture.md) — the `savvy commit` commands and the hook's rule gating
- [`../silk/plugin.md`](../silk/plugin.md) — the `commit-create` skill
