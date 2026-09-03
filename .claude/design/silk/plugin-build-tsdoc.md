---
status: current
module: silk
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./plugin.md
  - ./plugin-hooks.md
  - ./plugin-dogfood.md
  - ../tsdown-plugins/architecture.md
  - ../bundler/architecture.md
dependencies: []
---

# plugins/silk — build and TSDoc capability

The [silk plugin](./plugin.md)'s agent-facing half of the `@savvy-web/bundler` toolchain: the `build` skill for build configuration, the `tsdoc` skill and `tsdoctor` agent for API Extractor / TSDoc diagnostics and the `tsdoc-diagnostics` background monitor. All three read the structured `dist/<target>/issues.json` artifact `@savvy-web/tsdown-plugins` writes on every build (`../tsdown-plugins/architecture.md`).

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [The build skill](#the-build-skill)
- [The tsdoc skill](#the-tsdoc-skill)
- [The tsdoctor agent](#the-tsdoctor-agent)
- [The tsdoc-diagnostics monitor](#the-tsdoc-diagnostics-monitor)
- [Rationale](#rationale)

## Overview

The pieces: `skills/build/` and `skills/tsdoc/` (each with bundled `references/`), `agents/tsdoctor.md` and `monitors/watch-issues.mjs`. The artifact they all read is produced by `@savvy-web/tsdown-plugins`' `writeIssuesArtifact`.

## Current State

Implemented. Both skills, the agent and the monitor ship as described, and every consumer reads `buildOk` three-state. `tests/monitor-watch-issues.bats` pins the monitor's gates.

## The build skill

`skills/build/SKILL.md` (`/silk:build`, `paths`-triggered on `savvy.build.ts`, `package.json` and `turbo.json`) is the authoring reference for `@savvy-web/bundler`, `@savvy-web/rspress-builder` and `@savvy-web/tsdown-plugins`, self-contained via bundled `references/`. It shares the `savvy.build.ts` auto-load path with `tsdoc` by design: `build` owns build *config*, `tsdoc` owns doc *comments*.

Its load-bearing section is **"Reading a build as evidence"**: two distinct failures produce a build log that reads exactly like a clean gate. A hand-run `node savvy.build.ts --target prod` is not the `build:prod` task (it skips `types:check` and `build:dev`, may emit no `.d.ts` and can leave a truncated `issues.json`), and a turbo cache hit replays the previous run's output verbatim. The tell is the artifact, not the log: `issues.json`'s **`generatedAt`** — the timestamp the build wrote into the artifact — must postdate the newest source edit. `generatedAt` and the file's mtime are NOT interchangeable: a turbo cache restore writes the artifact with the current time, so mtime is refreshed on every replay while `generatedAt` keeps the original build's value, which makes an mtime comparison report "fresh" for every replayed artifact. `--force` is what tells "the build never saw the edit" apart from "the edit is not an input to the task hash".

## The tsdoc skill

`skills/tsdoc/SKILL.md` (`/silk:tsdoc`, `paths`-triggered on `savvy.build.ts` and `dist/*/issues.json`) teaches toolchain-correct TSDoc and the binary `@public`/`@internal` release-tag policy that `runApiExtractor` enforces in code. Every rule has the same shape — name the diagnostic, name the fix, explain the parser reason — which is what keeps it a reference rather than a checklist. Its verify step reads `dist/prod/issues.json` with a `jq` filter rather than grepping build stdout, and reads the artifact **three-state**: `buildOk: true` with empty buckets is clean; `false` is a crashed build whose empty buckets describe nothing; absent is an artifact from a bundler predating the stamp and means *unknown*, not a pass. That three-state read is the contract every consumer of the artifact repeats.

## The tsdoctor agent

`agents/tsdoctor.md` drives a package's diagnostics to zero end to end: prod build (the `ae-*`/`tsdoc-*` codes come from the prod-only meta pass) → read the artifact → fix per the release-tag policy → rebuild to confirm. It preloads `tsdoc` and edits only source TSDoc and the export/release-tag surface. Its boundary: it **never adds `suppressWarnings` entries** — suppression is a human escape hatch — and it surfaces a genuine `@beta`/`@alpha` maturity call to the user rather than guessing. It refuses to trust the buckets until `buildOk: true` is confirmed.

## The tsdoc-diagnostics monitor

`monitors/watch-issues.mjs` (registered in `monitors/monitors.json`) polls `dist/*/issues.json` across packages and surfaces non-zero `ae-*`/`tsdoc-*` counts as agent notifications. It is the template the other monitors follow: a pure exported `diagnose` step tests can import, a `--once` diagnostic mode and a `realpathSync` entry check so a symlinked plugin root still starts it.

The artifact is a gitignored, shared, mutable file and therefore a poor channel for cross-agent evidence — a stray build from another tree rewrites it, a crashed build writes an all-zeros version and a reviewer proving a fix is load-bearing must reintroduce the bug and rebuild. The monitor therefore reports only an artifact it can **vouch for**; each gate is a reason to stay quiet, never to report harder, and each is pinned as silence in `tests/monitor-watch-issues.bats`:

- **Debounce.** A non-zero count must hold unchanged across `STABLE_POLLS` polls (env-overridable) before it fires, so churn during active fixing or a fresh build never notifies; a return to zero clears the dedup so a later regression fires again. The producer writes atomically (tmp + rename), so debounce covers *stale* counts and the atomic write covers *partial* ones.
- **`buildOk === true`, read three-state** as above; absent stays quiet.
- **The artifact must be at least as new as the package's `src/**` sources**, by mtime. This is deliberately mtime, NOT `generatedAt`, and is untouched by the divergence the build skill warns about: a cache restore stamps the artifact with the current time, which makes it correctly newer than the sources it was built from. Reading `generatedAt` here would make every legitimate cache replay look stale. A package with no visible source tree is cannot-vouch.
- **The package's `src/**` and `savvy.build.ts` must be clean**, checked at most once per tick and only for a candidate that cleared the other gates; the `isDirty` callback is injected so `diagnose` stays pure. The scope matches the freshness gate — an uncommitted test file is not an input to the diagnostics pass.
- **A per-project advisory pid lock** keeps one resident watcher per project. The lock file lives in `tmpdir()` keyed on the realpath'd project root, is acquired by exclusive create (`wx`, never read-then-write), is refreshed by a per-tick heartbeat so a recycled pid cannot hold it forever and is judged by age when its contents do not parse. Any other write error means run unlocked rather than not at all — the lock is noise control, not a correctness precondition. `--once` skips it. The bats suite has a resident-mode case for the read-only-tmp fallback because `--once` cannot exercise lock behaviour.

The notification names the count, the target and the artifact path to read, and closes by saying it reports **an artifact, not the state of any agent's in-flight work**. It deliberately does not recommend dispatching `tsdoctor`: a monitor that both reports a shared mutable artifact and prescribes a fixer turns every stray build into dispatched work.

## Rationale

### Why a monitor, not a hook

A `FileChanged` hook was rejected: its matcher is literal-filename only (no glob across packages) and it injects no context, so it cannot say *which* package regressed. A background poller can watch every package's artifact and emit a notification naming the package, target and path, leaving the dispatch decision to a reader who can see the tree.
