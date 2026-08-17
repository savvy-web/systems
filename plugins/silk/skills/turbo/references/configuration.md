# turbo.json configuration deep dive

`turbo.json` at the repo root defines the task graph and the global hash inputs. Packages
may add their own `turbo.json` that `extends` the root to override task definitions for
that workspace. This reference covers the fields you reach for most.

## tasks

The `tasks` map keys are task names (matching the `scripts` entry that runs them) and the
values are task definitions:

```jsonc
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["$TURBO_DEFAULT$", "!**/*.md"]
    }
  }
}
```

A package-level `turbo.json` uses `"extends": ["//"]` to inherit the root and override
only the tasks it needs.

## dependsOn

Declares ordering and hash dependencies. Two forms:

- **Same-package** — a bare task name (`"dependsOn": ["codegen"]`) means "run *this*
  package's `codegen` before its `build`."
- **Topological** — a `^`-prefixed name (`"dependsOn": ["^build"]`) means "run the `build`
  of every UPSTREAM workspace dependency first." This is how a consumer waits for its
  libraries' `dist` to exist.

You can mix them: `"dependsOn": ["^build", "codegen"]`. The upstream tasks' hashes feed
this task's hash, so upstream changes invalidate it transitively. A task with no
`dependsOn` and no inputs from others runs immediately and in parallel.

## outputs

Globs (relative to the package) for the files the task produces. Required for the cache to
restore artifacts — omit it and only logs are cached. Supports `!` exclusions:
`["dist/**", "!dist/**/*.tsbuildinfo"]`.

## inputs

Globs for the files whose contents feed the task hash. Special tokens:

- `$TURBO_DEFAULT$` — expands to the default input set (all tracked, non-gitignored files
  in the package). Combine with exclusions to start from the default and trim:
  `["$TURBO_DEFAULT$", "!**/*.test.ts"]`.
- `$TURBO_ROOT$` — anchors a glob at the monorepo root so a package task can depend on a
  shared root file: `["$TURBO_ROOT$/tsconfig.base.json"]`.

Omitting `inputs` entirely uses the default set. Tightening it is the main lever for cache
hit rate.

## cache

`"cache": false` disables caching for the task — Turbo always runs it and never stores or
restores outputs. Use for tasks with side effects (publish, deploy) or persistent/dev
tasks. Defaults to `true`.

## persistent

`"persistent": true` marks a long-running task (dev server, watcher) that never exits.
Turbo won't allow another task to `dependsOn` a persistent task (it would never finish),
and persistent tasks are typically paired with `"cache": false`.

## interactive

`"interactive": true` lets a task receive stdin (for prompts, REPLs). Implies it's not
cacheable and is meant to be run directly rather than as a graph dependency.

## globalDependencies

Files whose contents feed the **global** hash — they invalidate *every* task when changed.
Reserve for files that genuinely affect all builds: a root tsconfig, a shared lint config,
a Dockerfile. The lockfile is already hashed implicitly, so it need not be listed. Keep
this list minimal; a broad glob here turns every unrelated edit into a full cache bust.

> Silk note: this repo also lists root files like `$TURBO_ROOT$/pnpm-lock.yaml` in
> per-task `inputs` (belt-and-suspenders — it keeps invalidation scoped per task rather
> than relying solely on the implicit lockfile hash), so don't be surprised to see the
> lockfile referenced explicitly in `turbo.json`.

## globalEnv

Env vars whose **values** feed the global hash for every task (e.g. `NODE_ENV`,
`CI`). Like `globalDependencies`, a change invalidates everything, so list only vars that
truly affect all task outputs. Per-task `env` is almost always the better-scoped choice;
reach for `globalEnv` only when the variable legitimately changes every task's output.

## globalPassThroughEnv

Env vars passed through to every task's environment **without** contributing to the hash —
the global counterpart of per-task `passThroughEnv`. This repo uses it for `CI` and
`GITHUB_ACTIONS` (`"globalPassThroughEnv": ["GITHUB_ACTIONS", "CI"]`), so those reach
every task at runtime while staying out of the cache key.

## Per-task env vs passThroughEnv

Though declared inside a task (not globally), these pair with the global ones:

- `env` — vars whose values feed *this task's* hash. Declare every env var the task's
  output depends on.
- `passThroughEnv` — vars made available to the task process but excluded from the hash.
  For runtime-only values (tokens, flags) that must not invalidate the cache.

## Silk note

Respect the established `dependsOn` chains between packages — a consumer's build waits on
its upstream libraries. Leave the per-package `prepare: turbo run build:dev` scripts alone:
they are what makes a `workspace:*` consumer's `link:` resolve during `pnpm install`, and
`dependsOn` cannot substitute for them because it never reaches the install step. What must
stay out of an install hook is `build:prod`, whose peer-catalog resolution reads a workspace
state file pnpm writes only after install scripts complete.
