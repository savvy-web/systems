# Turborepo caching deep dive

Turborepo skips work by computing a hash for each task invocation. If a hash has been
seen before — locally or on a remote cache — Turbo restores that task's recorded outputs
and replays its logs instead of running it. Understanding the hash is the whole game:
every cache miss is some input to the hash that changed.

## How the hash is computed

A task's hash is a function of two layers.

**The global hash** (shared by every task in the run):

- `globalDependencies` — the contents of the files you list (e.g. a root `tsconfig`,
  `pnpm-lock.yaml` is hashed implicitly). Anything here invalidates *all* tasks.
- `globalEnv` — the values of the env vars you declare globally.
- The resolved `turbo.json` itself and the Turbo version.
- The package manager and lockfile.

> Silk note: this repo also lists root files like `$TURBO_ROOT$/pnpm-lock.yaml` in
> per-task `inputs` (belt-and-suspenders, keeping invalidation scoped per task) rather
> than relying solely on the implicit lockfile hash — so you'll see the lockfile
> referenced explicitly in `turbo.json`.

**The per-task hash** (specific to this package + task):

- `inputs` — the matched source files' contents. If you don't set `inputs`, Turbo uses
  every non-gitignored file in the package (the `$TURBO_DEFAULT$` set) plus any explicit
  globs.
- `env` — the values of the env vars the task declares it depends on.
- The resolved task definition (its `dependsOn`, `outputs`, `cache`, etc.).
- The hashes of the upstream tasks this task `dependsOn` (so a changed library busts its
  consumers transitively).
- External dependency hashes — the resolved versions of the package's dependencies, read
  from the lockfile.

Change any one contributor and the hash changes and the task re-runs.

## inputs

`inputs` narrows what feeds the per-task hash. Precision here is the single biggest lever
for cache hit rate:

- Default (unset) hashes all tracked files in the package — so editing a README rebuilds
  the package.
- `["$TURBO_DEFAULT$", "!**/*.md"]` keeps the default set but excludes docs.
- Listing only `["src/**", "tsconfig.json"]` is tightest but you must remember every file
  that genuinely affects output, or you'll get false HITs (stale artifacts).
- `$TURBO_ROOT$` anchors a glob at the repo root for referencing shared root files.

## outputs

`outputs` declares the files a task produces so they can be saved and restored on a HIT:

- Omitting `outputs` caches only the task's logs — a HIT replays logs but restores **no
  files**, so anything downstream that reads those files rebuilds. Always declare emitted
  dirs (`dist/**`, `.next/**`, etc.).
- Globs are relative to the package. Use `!` to exclude (e.g. `["dist/**", "!dist/**/*.map"]`).
- Outputs are what get uploaded to and downloaded from the remote cache.

## Environment variables in the hash

Env vars are a notorious source of "works on my machine" cache divergence:

- `env` (per task) / `globalEnv` — the **values** are hashed, so a different value =
  different hash = miss. Declare every env var a task's output actually depends on.
- `passThroughEnv` — vars the task can read at runtime but that are **excluded from the
  hash**. Use for values that must reach the process but must not invalidate the cache
  (e.g. a CI token that doesn't change output).
- Undeclared env vars that a task reads are a correctness bug: the output depends on them
  but the hash doesn't, so you get false HITs. Turbo's strict env mode (the default in
  Turbo 2) hides undeclared vars from the task to force you to declare them.

## Local vs remote cache

- **Local** — `node_modules/.cache/turbo` (or the configured dir). A HIT restores from
  disk; this is per-machine.
- **Remote** — a shared cache (Vercel Remote Cache or a self-hosted/custom endpoint). The
  hash is the lookup key, so a teammate or CI runner with the same hash downloads your
  outputs instead of rebuilding. The hash must be reproducible across machines for this to
  work — which is why undeclared env vars and absolute paths in inputs break remote hits.

## Common miss causes

1. An unexpected file in the input set (overly broad/default `inputs`) — tighten `inputs`.
2. A changed env-var value feeding the hash — confirm it belongs in `env`; if it shouldn't
   invalidate, move it to `passThroughEnv`.
3. A global change (`globalDependencies` / `globalEnv`, a root `.env`) busting everything —
   narrow the global set.
4. A changed upstream task (`dependsOn`) transitively invalidating the consumer — expected;
   verify the upstream change was real.
5. A lockfile change altering an external-dependency hash.
6. Nondeterministic outputs (timestamps, embedded paths) producing different artifacts the
   cache can't reuse downstream.

## Diagnose with turbo_inspect

Call `mcp__savvy-mcp__turbo_inspect` with `mode: "cache"` and the task name. It returns a
per-package HIT/MISS verdict plus the exact hash contributors — input files, env vars,
external-dep hashes, and the global hash — so you can diff the contributors between a HIT
run and a MISS run and identify the one that changed, without hand-parsing
`turbo … --dry=json`.
