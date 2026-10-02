---
"@savvy-web/cli": minor
---

## Features

`savvy` asks for what it needs when a person runs it at a terminal, and confirms before it discards work. Agents, CI and pipes behave as before: a missing required argument is still a usage error (exit 64), and nothing prompts.

- `savvy init` offers a preset picker when `--lint-preset` is omitted, and `--force` asks before overwriting files that already exist.
- `savvy repos` commands that take a repo name (`pin`, `rename`, `note`, `remove`, `deregister`) offer a picker when the name is omitted. `repos add` asks for a missing `--ref` or `--purpose`, and `repos note promote` for a missing `--into`.
- `savvy repos restore` with no names offers the dirty repos to choose from, and `repos restore` and `repos remove` confirm first. Pass `--yes` (`-y`) to skip a confirmation.
- `savvy clean` draws a live progress view at a terminal.
- Reports are richer documents: `savvy check` is one report with a section per tool (a collapsible group under GitHub Actions); `changeset check`, `changeset version`, `changeset deps regen` and `repos status` render tables; `changeset transform --check` shows a diff of the drift.
- Under GitHub Actions, `changeset check` and `lint text` findings are emitted as `::error` annotations.
- Failures render as a short report with a hint for what to do next.

## Bug Fixes

`savvy check` now exits 1 when commitlint or lint-staged setup needs `savvy init`: a missing config or hook, a hook section that is absent or out of date, or an outdated `$schema`. It previously exited 0 unless a changeset failed. Advisory findings still exit 0.

## Other

- Core's generic `--wizard` flag is gone; `--help`, `--version`, `--completions` and `--log-level` remain.
- A failing changeset step in `savvy init` is reported and sets exit 1, but the commitlint and lint-staged steps still run.
- The exported command handlers (`run*` from the package index) now require the presentation environment (`CliTheme`, `TerminalEnv`, `Audience` and `CliLinks`, which `savvy` provides from its runtime) in place of `Stdio`. `runCommitCheck` and `runLintCheck` also require `CliExit`, since they set the findings exit code, and `runCheck` now composes sections that each return a `CheckSection`.
- `@savvy-web/cli` now depends on `ink` and `react`. They load only when a prompt or live view is drawn, never on a non-interactive run.
- Unchanged: the Claude Code hook handlers, `lint fmt`, the `changeset lint` and `changeset validate-file` line formats, `deps detect`, every `--json` document and `transform --dry-run`.
