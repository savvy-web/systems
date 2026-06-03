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
- `savvy commit` — the husky/Claude hook handlers (session-start, pre-commit-message, post-commit-verify, user-prompt-submit).
- `savvy changeset` — changeset lint, transform, version, classify, branch analysis, release-surface and config inspection.
- `savvy lint` — formatters for package.json, the pnpm workspace file and YAML.

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
