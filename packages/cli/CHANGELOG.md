# @savvy-web/cli

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
