# @savvy-web/cli

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fcli?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The `savvy` binary — one command for the everyday dev tooling in a [Silk Suite](https://github.com/savvy-web/systems) project. It sets up changeset, commit and lint conventions, checks them and runs the git hooks behind them, replacing the three separate `savvy-changesets`, `savvy-commit` and `savvy-lint` bins.

## Install

```bash
npm install --save-dev @savvy-web/cli
# or
pnpm add -D @savvy-web/cli
```

Most projects install [`@savvy-web/silk`](https://www.npmjs.com/package/@savvy-web/silk) instead, which pulls in `@savvy-web/cli` along with the matching suite versions and the config files the `savvy` commands expect.

## Quick start

Set up a project, then check it:

```bash
npx savvy init
# initializes changeset, commit and lint conventions in one pass

npx savvy check
# runs the changeset, commit and lint checks; reports every failure in one pass
```

`savvy init` and `savvy check` are the only setup entry points. The command groups expose the remaining per-tool operations:

```bash
npx savvy changeset version
# applies pending changesets and bumps package versions

npx savvy lint fmt package-json
# formats package.json files to the Silk Suite conventions
```

Remove build and cache artifacts across the whole workspace:

```bash
npx savvy clean --dry-run
# previews what would be removed across every workspace package and the repo root

npx savvy clean --globs dist,.turbo,coverage
# removes only the given patterns
```

## Commands

- `savvy init` — orchestrator that runs changeset, commit and lint setup in one pass.
- `savvy check` — orchestrator that runs all three checks and reports every failure (it does not short-circuit).
- `savvy clean` — removes build and cache artifacts (`dist`, `.turbo`, `coverage`, `node_modules`, `.rslib` by default) from every workspace package (leaves first) and the repo root (last); `--globs` to customize, `--dry-run` to preview.
- `savvy commit` — the husky/Claude hook handlers (session-start, pre-commit-message, post-commit-verify).
- `savvy changeset` — changeset lint, check, transform, version, config validation, and dependency changesets.
- `savvy lint` — formatters for package.json, the pnpm workspace file and YAML.
- `savvy repos` — the vendored reference repos declared in `.repos/config.json`: `status` (with `--drift`), `sync`, `pin`, `add`, `note`, `remove`, `rename` and `restore`.

## Vendored repos are read-only

`savvy repos sync`, `add`, `pin`, `remove`, `rename` and `restore` leave every vendored worktree under `.repos/` read-only at the OS level — files `0444`, directories `0555` (an executable file locks at `0555` instead, and unlocks back to `0755` rather than losing its executable bit). Reading a vendored source needs no extra step; writing to one fails with `EACCES` by design, because those trees mirror an upstream repo at a pinned ref and any local edit is lost on the next sync. A dirty tree from a hand bypass recovers with `savvy repos restore <name...>` (or with no names, every dirty tree) rather than a manual `git reset`. Restore is destructive by design: it hard-resets each tree it touches to the pinned commit, so uncommitted edits and untracked files in that tree are gone. When a reset runs but the worktree is still dirty afterwards, restore says so per repo and exits `1`, so a script cannot read an incomplete restore as a clean one.

The lock stops at the worktree. Each submodule's git metadata under `.git/modules/` stays writable, so a plain `git pull` and any GUI client that keeps its own per-gitdir state work normally in a repo that vendors sources this way. `sync` and `add` also declare the boundary to git rather than leaving clients to discover it by failing: they write `submodule.<path>.update = none` per entry and `fetch.recurseSubmodules = false` into the repo's local config, so ordinary git commands skip these trees. A `git checkout` inside a vendored worktree is therefore detected rather than blocked — `savvy repos status --drift` reports it and `savvy repos restore` repairs it.

```bash
npx savvy repos sync
# reconciles .repos/ with the manifest and re-locks every tree

npx savvy repos pin effect v4.0.0
# fetches, checks out the new ref, re-locks, and stages the gitlink and manifest

npx savvy repos restore
# hard-resets every dirty tree to its pinned commit and reports the clean ones as skipped

npx savvy repos status --drift
# reports where the manifest, .gitmodules, the worktree and git submodule status disagree
```

A manual `chmod` only holds until the next mutation. Route changes through `savvy repos` instead.

Run any command with `--help` to see its full surface:

```bash
npx savvy changeset --help
# lists the changeset subcommands and their options
```

## Programmatic API

The package also exports the assembled command tree and its handlers for embedding `savvy` in another program:

```ts
import { runCli } from "@savvy-web/cli";

await runCli(process.argv);
```

The individual command groups (`changesetCommand`, `commitCommand`, `lintCommand`) and their named handlers are exported from the package root.

## License

[MIT](LICENSE)
