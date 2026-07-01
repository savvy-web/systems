---
name: turbo
description: >
  Use when configuring Turborepo tasks, debugging cache misses, controlling which
  packages a command runs against (--affected / --filter), reasoning about turbo.json
  dependsOn / outputs / inputs, or understanding the Silk monorepo build chain. Covers
  decision trees, anti-patterns with rationale, and the turbo_inspect MCP tool for cache
  diagnosis.
when_to_use: >
  "why is my turbo cache missing?", "configure a turbo task", "set up dependsOn",
  "run only changed packages", "turbo.json", "what's the task graph?", "speed up the
  monorepo build", "turbo cache isn't working"
---

# Turborepo in the Silk monorepo

Diagnose with data, not guesswork. Turborepo's behavior is fully determined by the
task hash and the task graph; both are inspectable. Before you theorize about why a
cache missed or why a task ran, pull the actual hash contributors and the actual graph.

## Diagnose cache misses with turbo_inspect (don't hand-parse)

Call the `mcp__plugin_silk_savvy-mcp__turbo_inspect` MCP tool instead of hand-running
`turbo run … --dry`/`--summarize` and parsing the output yourself.

- `mode: "cache"` + a task name — returns, per package, a HIT/MISS verdict plus the
  exact hash contributors: the matched input files, the env vars that fed the hash,
  the external-dependency lockfile hashes, and the global hash. This is the fastest
  way to answer "why did this miss?" — compare the contributors between the two runs
  and the changed one is your culprit.
- `mode: "graph"` — returns the task graph and the critical path, so you can see what
  blocks what and where the long pole is before you try to parallelize.
- `mode: "affected"` — returns the changed-package set (what `--affected` would select)
  given the current working tree / base ref.

Reach for these first. Only fall back to raw `turbo … --dry=json` if you need a field
the tool does not surface.

## Decision trees

### I need to configure a task

- Does it depend on the SAME package's other tasks (e.g. `build` needs `codegen`)?
  → list the bare task name in `dependsOn`: `"dependsOn": ["codegen"]`.
- Does it depend on UPSTREAM packages' output (a library must build before its
  consumer)? → prefix with `^`: `"dependsOn": ["^build"]`.
- Does it produce files you want cached/restored? → declare them in `outputs`
  (omitting `outputs` caches logs only and restores nothing).
- Is it a long-running dev server or watcher? → `"persistent": true` (and usually
  `"cache": false`).
- Does it write nondeterministic output or have side effects (publish, deploy)? →
  `"cache": false`.
- See `references/configuration.md` for the full field reference.

### My cache isn't working

1. Run `mcp__plugin_silk_savvy-mcp__turbo_inspect` `mode: "cache"` for the task and read the
   contributors.
2. A different INPUT file hash → an unexpected file is in the task's input set; tighten
   `inputs`.
3. A different ENV var → declare it in the task's `env` (or `passThroughEnv` if it must
   not invalidate), or it leaked in via `globalEnv`.
4. A different GLOBAL hash → something in `globalDependencies`/`globalEnv` changed (a
   root `.env`, a root config). Narrow `globalDependencies`.
5. Different EXTERNAL-dep hash → the lockfile changed for a dependency that task uses.
6. See `references/caching.md` for how the hash is computed end to end.

### Run only changed packages

- Default: `turbo run build --affected` — builds packages changed vs the base ref and
  their dependents. Use `mode: "affected"` to preview the set first.
- Target specific packages: `--filter=@savvy-web/cli` (add `...` for dependents/
  dependencies, e.g. `--filter=...@savvy-web/silk-effects`).
- CI should compare against the merge base, not a fixed branch; `--affected` handles
  the base detection.

### Speed up the build

1. `mode: "graph"` to find the critical path — the longest dependency chain is your
   ceiling; parallelizing off-path work won't help.
2. Tighten `inputs` so unrelated edits stop invalidating tasks (more cache HITs).
3. Make sure `outputs` are complete so restores actually skip work.
4. Use a "transit task" (an empty task that only fans out `dependsOn`) to express
   ordering without forcing serialization — see anti-patterns below.

## Anti-patterns (rationale; deep dives in references/ and the corpus)

- **`build` where you meant `^build`** — bare `build` in `dependsOn` means "this
  package's own build," not upstream packages'. A consumer that lists `build` instead
  of `^build` won't wait for its libraries and will build against stale `dist`.
- **No transit task for parallel-with-correct-invalidation** — when you need ordering
  ("typecheck after all upstream builds") but not serialization, an empty transit task
  that only carries `dependsOn` lets independent work run in parallel while preserving
  correct invalidation. Stuffing the ordering into a real task over-serializes.
- **Root `.env` in the hash** — a checked-in or broadly-globbed root `.env` pulled into
  `globalDependencies` invalidates EVERY task on any env change. Scope env through
  per-task `env`/`passThroughEnv` instead.
- **`--parallel` misuse** — `--parallel` ignores the dependency graph and runs
  everything at once; correct only for independent tasks (lint across packages), wrong
  for anything with `dependsOn`, where it races against unbuilt upstreams.
- **`prebuild` lifecycle scripts** — npm's `pre`/`post` lifecycle hooks run outside
  Turbo's graph, so their work isn't hashed, cached, or ordered. Model the step as a
  real turbo task with its own `dependsOn`/`outputs` instead.
- **Overly broad `globalDependencies`** — globbing `**` or a whole config dir into
  `globalDependencies` makes unrelated edits bust every cache. List only the files that
  genuinely affect all tasks.
- **Missing `outputs`** — a task with no `outputs` caches its logs but restores no
  files, so a "HIT" still leaves you with no artifacts and downstream tasks rebuild.
  Declare every emitted dir/file.

## Silk conventions

- pnpm 11.x workspace; dependencies pinned via `catalog:silk`, peer ranges via
  `catalog:silkPeers`.
- Install and build are DECOUPLED. `pnpm install` never builds; build is the explicit
  post-install `pnpm build` (turbo `build:dev` + `build:prod`). NEVER build inside a
  `prepare`/`postprepare` hook — an install-time build resolves `catalog:silkPeers`
  before pnpm has written the workspace state file and fails with
  `Catalog(s) not found: silkPeers`. Order is always install → build → checks.

## Deep dives

- `references/caching.md` (bundled — read on demand): how the hash is computed, inputs/
  outputs, env contributions, local vs remote cache, common miss causes.
- `references/configuration.md` (bundled): the full `turbo.json` field reference —
  `tasks`, `dependsOn`, `outputs`, `inputs`, `cache`, `persistent`, `globalDependencies`,
  `globalEnv`.
- Turborepo standards (bundled): `references/best-practices.md`,
  `references/boundaries.md`, `references/ci.md`, `references/environment.md`,
  `references/filtering.md`, `references/watch.md`.
