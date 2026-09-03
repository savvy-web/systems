---
status: current
module: mcp
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./architecture.md
  - ./tools.md
  - ./biome-check.md
  - ./repos-tools.md
  - ../silk-effects/architecture.md
  - ../cli/architecture.md
  - ../silk/plugin.md
dependencies:
  - ./architecture.md
  - ./tools.md
---

# @savvy-web/mcp changeset tools

The five `savvy-mcp` tools over silk-effects' `Changesets` namespace — `changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_detect` and the mutating `changeset_deps_regen` — and the shared-inspector discipline they all depend on.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The shared inspector](#the-shared-inspector)
- [changeset_inspect](#changeset_inspect)
- [changeset_validate](#changeset_validate)
- [changeset_preview](#changeset_preview)
- [changeset_deps_detect and changeset_deps_regen](#changeset_deps_detect-and-changeset_deps_regen)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

These tools are the structured inspection surface for changesets: the silk plugin's `changeset-manager` agent, `changeset-preview` skill and `dependencies` skill drive them (see [plugin.md](../silk/plugin.md)), and the `savvy changeset` CLI keeps only the mutating release commands. Every tool follows the conventions in [tools.md](./tools.md); this doc covers what is specific to the family.

## Current state

One file per tool under `src/tools/`. Four are read-only and register `readOnlyHint`; `changeset_deps_regen` is one of the three mutating tools and registers `destructiveHint`. All resolve the workspace root via `WorkspaceRoot.find` and run on the shared runtime, which holds one `Changesets.ConfigInspector`, one `BranchAnalyzer`, one `ReleasePlanner` and one `DepsRegen` for the process lifetime (see [architecture.md](./architecture.md#the-runtime-layer)).

## The shared inspector

The server is long-lived and its single `ConfigInspector` cache never self-expires, so `changeset_inspect` calls `inspector.refreshIn(root)` **once up front, before dispatching on `mode`** — a per-call, per-root refresh so every mode observes on-disk edits made since the last tool call, `branch` included (its `BranchAnalyzer` reads through the same shared inspector). Refreshing only the inspected root leaves sibling worktrees' still-valid caches intact. Any new tool that reads through the inspector must do the same.

## changeset_inspect

`changeset_inspect` (`src/tools/changeset-inspect.ts`) is a **discriminated union keyed by `mode`**: `branch` wraps `BranchAnalyzer.analyzeBranch` (diff-against-base file classification with `packagesAffected` and the unmapped paths to ask the user about), `config` wraps `ConfigInspector.inspect` (the resolved `.changeset/config.json`) and `classify` wraps `ConfigInspector.classify` (arbitrary paths → owning package). An unmapped path in `branch`/`classify` output may carry a machine-readable `unmappedHint` reason — a `versionFiles`/`additionalScopes` glob that names the path without a materialized file behind it, or a known template mirror — which the transcript renders beside the path so the agent can treat it as probably-already-accounted-for; attribution stays `null`. Inspection is worktree-aware: discovered package paths are re-rooted onto the per-call project dir, so inspecting from a git worktree speaks that worktree's paths, with the limitation that names and versions still read from the layer-bound root's manifests (see [silk-effects/architecture.md](../silk-effects/architecture.md)).

## changeset_validate

`changeset_validate` (`src/tools/changeset-validate.ts`) validates the files in `.changeset/` (or a given `dir`) against the `@savvy-web/changesets` format rules via the pure `Changesets.ChangesetLinter.validate`, wrapping its thrown failure in a typed `ChangesetValidateError`. The result carries the typed diagnostics plus `ok` and `errorCount`. It is the structured counterpart to `savvy changeset lint`.

## changeset_preview

`changeset_preview` (`src/tools/changeset-preview.ts`) wraps `Changesets.ReleasePlanner.preview`, which runs the genuine changesets engine over the pending `.changeset/` files against a throwaway temp directory — never mutating the repo — and returns each package's version bump plus the rendered CHANGELOG block exactly as it would ship. Only `preview` is exposed. `ReleasePlanner.apply` is the destructive native release and is intentionally kept off MCP; it lives behind `savvy changeset version` (see [cli/architecture.md](../cli/architecture.md)).

## changeset_deps_detect and changeset_deps_regen

Both tools sit on `Changesets.DepsRegen` and split along "read first, then act".

`changeset_deps_detect` (`src/tools/changeset-deps-detect.ts`) calls `DepsRegen.plan({ includeDevDeps: true, ... })` — the read-only path, so devDependencies stay in the diff and no file is touched — and returns each affected package's resolved dependency-table rows exactly as a pure-dependency changeset would carry them (`catalog:`/`workspace:` specifiers resolved per side, hook-injected catalogs to their declared ranges) plus a `coexisting` list of untouched prose-only changesets that reference an in-scope package, so the agent need not re-list `.changeset/` to see a package's full changeset picture.

`changeset_deps_regen` (`src/tools/changeset-deps-regen.ts`) calls `plan(...)` and then, unless `dryRun` is set, `execute(plan)`: it deletes only the single-package Dependencies-only changesets the plan marked for replacement (in scope, rewritten this run and authored on this branch rather than at the merge base) and writes fresh ones from the current diff (devDependencies dropped, protocol specifiers resolved). Mixed changesets are left untouched and the result carries the same `coexisting` list. The mutation is never implicit — a bare `dryRun: true` call only computes the plan — and `.changeset/*.md` writes are git-reversible. The delete predicate and diff semantics belong to silk-effects; see [silk-effects/architecture.md](../silk-effects/architecture.md).

## Rationale

### Why a structured MCP surface rather than the CLI's `--json`

The CLI's `--json` output is prefixed with an `Effect.log` line that breaks naive `JSON.parse`, and Bash tool output is truncated. A typed `structuredContent` sidesteps both, which is why the inspection commands were moved off the CLI and onto these tools.

### Why detect and regen are two tools

An agent's dependency workflow is "read first, then act", and the two calls have different mutation classes. Keeping them separate lets `changeset_deps_detect` carry `readOnlyHint` honestly while `changeset_deps_regen` carries `destructiveHint`, instead of one tool whose safety depends on a flag.

### Why `apply` stays off MCP

A release is the one changeset operation that should need a human at a terminal. Exposing only `preview` keeps the tool family safe to call speculatively while still giving the agent the exact CHANGELOG it would ship.

## Related documentation

- [architecture.md](./architecture.md) — the runtime that holds the shared inspector.
- [tools.md](./tools.md) — the conventions these tools follow.
- [silk-effects/architecture.md](../silk-effects/architecture.md) — the `Changesets` services.
- [silk/plugin.md](../silk/plugin.md) — how the plugin drives `changeset_inspect`.
