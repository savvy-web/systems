---
"@savvy-web/silk": major
---

## Breaking Changes

### Changeset commands consolidated into a single `/silk:changeset` router

The five separate changeset slash commands are removed and replaced by one flag-driven command. Anyone with muscle memory or scripts invoking the old command names must switch to the new form:

| Old command | New command |
| --- | --- |
| `/silk:changeset-create [--require] [--package N] [--bump LVL] [--dry-run]` | `/silk:changeset --create [--require] [--package N] [--bump LVL] [--dry-run]` |
| `/silk:changeset-squash [branch\|all] [--package N] [--dry-run]` | `/silk:changeset --squash [branch\|all] [--package N] [--dry-run]` |
| `/silk:changeset-check` | `/silk:changeset --check` |
| `/silk:changeset-list` | `/silk:changeset --list` |
| `/silk:changeset-preview` | `/silk:changeset --preview` |

A bare `/silk:changeset` (no flag) defaults to create/reconcile. `/silk:changeset-style` is unaffected and keeps its own name.

## Features

### New `build` skill

`/silk:build` documents configuring and running `@savvy-web/bundler` (and its `rspress-builder` sibling) from a `savvy.build.ts` — the `build()` front door, the full `BuildConfig` option surface, `build:dev`/`build:prod`/`types:check`/`prepare` workspace and Turborepo wiring, SEA executables, and the API Extractor meta pass. It auto-loads whenever `savvy.build.ts` is opened.

### New `changeset-config` skill

`/silk:changeset-config` documents `.changeset/config.json` in a Silk repo — the two-element `changelog` tuple, the standard `@changesets/config` fields, and the Silk-custom per-package `versionFiles` and `additionalScopes` options. It auto-loads whenever `.changeset/config.json` is opened.
