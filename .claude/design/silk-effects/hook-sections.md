---
module: silk-effects
category: architecture
status: current
completeness: 90
created: 2026-09-03
updated: 2026-09-05
last-synced: 2026-09-05
related:
  - ./architecture.md
  - ./lint.md
  - ./commitlint.md
  - ../cli/architecture.md
  - ../silk/plugin.md
---

# Shared hook sections

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The kit engine](#the-kit-engine)
- [SavvySections](#savvysections)
- [The composition contract](#the-composition-contract)
- [The toolchain check](#the-toolchain-check)
- [The dependency auto-install](#the-dependency-auto-install)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

The Silk husky hooks share shell content — package-manager detection, hook hygiene, a package-manager drift warning — that used to be hand-written per consumer CLI. `src/schemas/SavvySections.ts` centralizes that content as *data*: section identities and the shell bodies they carry. The engine that renders and reconciles them inside user-editable hook files is the kit's `@effected/templates` `ManagedSection`.

## Current state

Implemented; driven by `savvy commit init`/`savvy lint init`/`savvy init` and verified by `savvy check` (`../cli/architecture.md`). The toolchain and install sections are the newest members and ship in `.husky/post-checkout` and `.husky/post-merge`.

## The kit engine

Identity is `SectionId.make({ key, commentStyle })`, content is `sectionId.section(body)` and `syncAll` is the multi-section compositor: every listed section ends up present in declared relative order, user content before/after/between is preserved, unrelated tool sections are untouched and the operation is idempotent. `check` returns a flat `CheckOutcome` (`UpToDate`/`Drifted`/`Absent`) matched with `$is`; `read` returns an `Option`. The marker format is fixed:

```text
# --- BEGIN {KEY} MANAGED SECTION ---
managed content here
# --- END {KEY} MANAGED SECTION ---
```

## SavvySections

`SavvySections.ts` exports the identities (`SavvyBaseSection`, `SavvyHooksSection`, `SavvyToolchainSection`) and the body builders (`savvyBasePreamble`, `savvyHooksHygiene`, `savvyToolchainCheck`, `savvyToolSection`). `SavvyInstallSection.ts` is a sibling module carrying the `SAVVY-INSTALL` identity and its own builders. See the source for the exact shell bodies.

**The section keys are uppercased at `SectionId` construction, and that one line is load-bearing.** The kit renders a key verbatim into its markers, while the markers already written into every consumer repo's hook files are `SAVVY-BASE`, `SAVVY-HOOKS`, `SAVVY-COMMIT`, `SAVVY-LINT`. A lowercase key would not error — `check` would report `Absent` and `sync` would append a second copy beside the first, silently duplicating hook logic. The private `shellSection` helper uppercases in one place; the CLI's own ids (`SAVVY-COMMIT` in `packages/cli/src/commands/commit/init.ts`, `SAVVY-LINT` in `src/lint/cli/sections.ts`) are spelled uppercase literally for the same reason. Any new Silk section identity goes through the same guard.

## The composition contract

`savvyToolSection(toolName, command)` produces a one-line section whose content is exactly `in_ci || pm_exec <command>`, with `command` appended verbatim — no parsing, quoting or interpolation, so shell tokens like `$ROOT` and `$1` survive into the literal. Its precondition is that a `savvy-base` section precedes it in the same hook file, since the preamble defines `ROOT`, `in_ci`, `PM` and `pm_exec`; consumers satisfy this by passing `[SavvyBaseSection.section(savvyBasePreamble()), savvyToolSection(…)]` to `syncAll` in that order. `pm_exec` uses local/exec semantics per package manager and the space form `bun x` (not the `bunx` shim) so it works however bun was installed.

## The toolchain check

`savvyToolchainCheck()` is the one block that is deliberately self-contained rather than composed on `savvy-base`. It lives in `post-checkout` and `post-merge` — drift becomes true exactly when a pin bump is pulled or a branch switched — and those hooks carry `SAVVY-HOOKS` but no `SAVVY-BASE`, so `ROOT`, `in_ci` and `PM` do not exist there. Defining its own root/CI/pin lookups is cheaper than pushing package-manager detection into hooks that otherwise need none. `post-commit` deliberately does not get it: it fires on every commit, which is noisier than the drift warrants.

It warns and never blocks (a hard failure would strand anyone mid-bisect or mid-rebase on an older pin) and installs nothing, which separates it from `devEngines.packageManager.onFail: "warn"` — that flag makes pnpm manage the package manager as a lockfile dependency, with every platform binary. Every input is optional (no git root, no `jq`, no `devEngines`, a manager not on `PATH` all mean "say nothing"), only an exact pin is comparable so ranges and wildcards are skipped, the `+sha512…` integrity tail is stripped before comparison and the `name` recorded in the pin decides which manager is asked.

## The dependency auto-install

`SAVVY-INSTALL` (`src/schemas/SavvyInstallSection.ts`) runs the detected package manager's install after a checkout or merge that changed dependencies, so a batch of repos pulled to align their dependencies does not each need a manual install. `savvyInstallDeps(hook)` builds the shell, `savvyInstallBlock(hook)` wraps it as a `Section`. Like `savvyToolchainCheck` it is deliberately self-contained — its homes carry `SAVVY-HOOKS` but no `SAVVY-BASE`, so it defines its own root, CI and package-manager lookups rather than leaning on `ROOT`, `in_ci` or `PM`.

It ships in `post-checkout` and `post-merge` only. `post-commit` is excluded for the same reason it has no toolchain check: it fires on every commit, which is far noisier than the event warrants. The pairing lives in the `HYGIENE_HOOKS` table that both `packages/cli/src/commands/lint/init.ts` and `packages/cli/src/commands/commit/init.ts` iterate — `undefined` in the install column is what keeps `post-commit` hygiene-only, and the matching `check` commands verify the same pairing.

**It is parameterized by hook rather than one block sniffing its own arguments**, because the two hooks disagree on both halves of the decision. `post-checkout` is handed `<prev> <new> <branch-flag>` and must ignore a file checkout; `post-merge` is handed only a squash flag and has to recover its range from `ORIG_HEAD`. Both are needed: a fast-forward `git pull` — the batch-alignment case this exists for — fires `post-merge` and never `post-checkout`.

Four guards keep it off the many checkouts that are not dependency events, each a silent no-op: CI, where the runtime action owns installation; `SAVVY_SKIP_INSTALL`, the escape hatch for a bisect or a scripted sweep; a `post-checkout` branch flag of `0`, which is `git checkout -- <file>` rather than a move between commits; and the diff gate over manifests and lockfiles, which is what makes the block affordable at all — without it every branch switch would pay for a full install. A missing `node_modules` overrides the diff gate, since there is nothing there to be stale. A fresh clone is not covered and cannot be: husky sets `core.hooksPath` from its own `prepare` script, so until the first manual install has run there is no hook to fire.

Installs skip lifecycle scripts by default (`--ignore-scripts`, or `--mode=skip-build` on Yarn Berry, which dropped the former). The exception, and the reason for the trust boundary below, is a workspace that publishes through built link directories.

The package-manager name is read from the checked-out revision's `packageManager` field, so it is attacker-influenced input: the parsed name is checked against `npm`/`pnpm`/`yarn`/`bun` before anything executes. `command -v` proves a binary exists, not that it is a package manager. Every probe that can legitimately fail — no `ORIG_HEAD`, an unresolvable range — is neutralised with `|| true`. These blocks are co-owned and consumer content can sit below them, so under a hook running `set -e` a bare failing substitution would abort the whole file and take the later sections with it.

## Rationale

### Why the keys are uppercased rather than the marker format changed

The kit renders a key verbatim; the previous local model uppercased it. Either convention is defensible in isolation, but the markers are already on disk in every consumer repo, and a mismatch does not error — it duplicates. Uppercasing at construction keeps the marker bytes identical, and changing the kit's rendering instead would have imposed Silk's spelling on every other kit consumer.

### Why lifecycle-script authorization is read from local git config, never from the tree

Whether a hook-time install runs lifecycle scripts is read from the LOCAL git config key `savvy.installLifecycleScripts`, exported as `LIFECYCLE_SCRIPTS_CONFIG_KEY`. Default off.

An earlier iteration answered the same question by scanning tracked manifests for `publishConfig.directory` plus `linkDirectory: true`, and it failed in both directions at once. A branch that merely declared that shape could re-enable lifecycle scripts just by being checked out, which makes `git checkout` of an untrusted revision a code-execution path. And the `jq` the scan required is absent on stock macOS and Ubuntu, where the missing answer silently skipped scripts in exactly the repos that cannot survive skipping them — a workspace resolving its own dependencies through a `dist/dev` link directory gets a populated `node_modules` pointing at nothing. `.git/config` is neither checked out nor parsed with `jq`, so it has neither failure mode. Do not simplify this back into a manifest scan.

`publishesBuiltLinkDirectory(manifest)` is the residue of that scan, kept as a pure predicate that only REPORTS the shape. `savvy init` uses it to print the opt-in command (`git config --local savvy.installLifecycleScripts true`) rather than setting the config itself, deliberately leaving the trust decision to whoever owns the checkout.

### Why data rather than a service

The mechanism (marker parsing, compositing, idempotent sync) carries no Silk opinion and belongs to the kit. What is Silk-specific is only the content and the identities, which are plain values and need no layer.

## Related documentation

- [Architecture overview](./architecture.md)
- [Lint namespace](./lint.md) — the `SAVVY-LINT` section id
- [Commitlint namespace](./commitlint.md)
- [`../cli/architecture.md`](../cli/architecture.md) — the `init`/`check` commands that sync and verify these sections
- [`../silk/plugin.md`](../silk/plugin.md) — the hook shell test suite
