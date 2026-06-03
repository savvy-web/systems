---
"@savvy-web/cli": minor
---

## Breaking Changes

The per-tool `init` and `check` subcommands were removed from the `changeset`, `commit`, and `lint` groups. `savvy init` and `savvy check` are now the only setup and validation entry points — run those instead of `savvy changeset init`, `savvy commit check`, `savvy lint init`, and the like. The groups keep their other subcommands (for example `savvy changeset version` and `savvy lint fmt`).

## Features

Added `savvy clean`, which removes build and cache artifacts across an entire silk workspace. Run from anywhere inside the workspace, it globs the configured patterns (default `dist`, `.turbo`, `coverage`, `node_modules`, `.rslib`) at the top level of every workspace package — leaves first, the repo root last — and deletes the matches. Patterns are configurable with `--globs`, and `--dry-run` previews what would be removed without touching disk.

* `clean` added to the root command tree alongside `init` and `check`
* top-level glob matching by default, with `**` opt-in that skips descent into `node_modules` and `.git`
* path-containment safety so a match can never escape its workspace root

## Bug Fixes

`savvy changeset init` now writes the `@savvy-web/silk/changesets/changelog` and `@savvy-web/silk/changesets/markdownlint` shim paths into a consumer's `.changeset/config.json` and markdownlint config, matching what `@savvy-web/silk` actually installs, instead of the pre-merge standalone `@savvy-web/changesets` specifiers. `savvy check` accepts both the silk and legacy paths, and `init` migrates a legacy markdownlint entry rather than duplicating it.
