# @savvy-web/cli

## 0.3.0

### Breaking Changes

* [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) The per-tool `init` and `check` subcommands were removed from the `changeset`, `commit`, and `lint` groups. `savvy init` and `savvy check` are now the only setup and validation entry points — run those instead of `savvy changeset init`, `savvy commit check`, `savvy lint init`, and the like. The groups keep their other subcommands (for example `savvy changeset version` and `savvy lint fmt`).

### Features

* [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) Added `savvy clean`, which removes build and cache artifacts across an entire silk workspace. Run from anywhere inside the workspace, it globs the configured patterns (default `dist`, `.turbo`, `coverage`, `node_modules`, `.rslib`) at the top level of every workspace package — leaves first, the repo root last — and deletes the matches. Patterns are configurable with `--globs`, and `--dry-run` previews what would be removed without touching disk.

- `clean` added to the root command tree alongside `init` and `check`
- top-level glob matching by default, with `**` opt-in that skips descent into `node_modules` and `.git`
- path-containment safety so a match can never escape its workspace root

### Bug Fixes

* [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) `savvy changeset init` now writes the `@savvy-web/silk/changesets/changelog` and `@savvy-web/silk/changesets/markdownlint` shim paths into a consumer's `.changeset/config.json` and markdownlint config, matching what `@savvy-web/silk` actually installs, instead of the pre-merge standalone `@savvy-web/changesets` specifiers. `savvy check` accepts both the silk and legacy paths, and `init` migrates a legacy markdownlint entry rather than duplicating it.

## 0.2.1

### Documentation

* [`a9ea047`](https://github.com/savvy-web/systems/commit/a9ea04701507a3d5fb290dbaa1eeb3d5f599a67b) Added package READMEs for `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp`. Each covers installation, quick-start usage, and the package's public surface — the `savvy` commands for the CLI, the drop-in config shim export map for silk, and the tool and resource surface for the MCP server. These READMEs ship with each package and render on its npm page.

## 0.2.0

## 0.1.0

### Features

* [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) ### savvy binary — unified Silk Suite CLI

`@savvy-web/cli` provides the `savvy` binary, replacing the three standalone bins (`savvy-changesets`, `savvy-commit`, and `savvy-lint`) with a single entry point.

Top-level commands:

* `savvy init` — set up Silk Suite tooling in a new or existing workspace
* `savvy check` — run all configured checks (changeset, commit, lint) in one pass

Subcommand groups:

**`savvy changeset`**

* `analyze-branch` — diff the current branch against the base and classify changed files by package
* `check` — validate all pending changeset files against the style rules
* `classify` — classify a single file path to its owning package
* `config show` / `config validate` — inspect and validate `.changeset/config.json`
* `deps detect` / `deps regen` — detect dependency changes and regenerate dependency changesets
* `init` — scaffold a `.changeset/` directory with Silk conventions
* `lint` — lint a single changeset file
* `release-surface` — print the computed release surface for a package
* `transform` — run the changelog post-processing pipeline on a markdown input
* `validate-file` — validate a changeset file path and frontmatter
* `version` — print the savvy changeset schema version

**`savvy commit`**

* `check` — validate a commit message against the Silk commitlint rules
* `hook` — run the pre-commit-message, post-commit-verify, session-start, and user-prompt-submit Claude Code hooks
* `init` — install husky hooks and Claude Code hook files

**`savvy lint`**

* `check` — run Biome, markdownlint, and other configured linters
* `init` — scaffold lint configuration files

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 0.5.0 | 0.6.0 |
