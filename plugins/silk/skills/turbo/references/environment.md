# Turborepo environment hashing

## Rule

Any environment variable that changes a task's **output** must be declared in
that task's `env`, or the cache will hand back output built under a different
value. Turbo only hashes env vars you declare; an undeclared var is invisible to
the cache and is the most common source of "it worked on my machine, the cache
gave me stale bytes" bugs.

## env vs globalEnv

- `env` (per task): vars that affect that task's output — e.g. `NODE_ENV` for a
  build, registry tokens for a publish step.
- `globalEnv` (root `pipeline`/`globalEnv`): vars that affect **every** task's
  hash. Use sparingly; an over-broad `globalEnv` busts every cache entry whenever
  it changes.

```jsonc
{
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build:prod": { "env": ["TURBO_TOKEN", "TURBO_TEAM"], "outputs": ["dist/prod/**"] }
  }
}
```

## passThroughEnv

`passThroughEnv` / `globalPassThroughEnv` make a var **available to the task
process without adding it to the hash**. Use it for things that must reach the
process but must not invalidate the cache — e.g. `GITHUB_TOKEN` during a
network-only step. Pass-through is the deliberate escape hatch; reaching for it
to hide a genuine input is how you reintroduce the stale-cache bug.

## globalDependencies

`globalDependencies` lists files outside any package whose contents should feed
every task hash — `tsconfig.base.json`, the root `biome.jsonc`, `.nvmrc`. When a
shared config changes, every cache entry should miss; that only happens if the
file is declared here.

## The root .env anti-pattern

Turbo does not read a root `.env` into task hashes. A var set only in `.env`
silently changes output while the hash stays constant, so the cache returns bytes
built under the old value. If a value must affect a build, declare it in `env`
and let CI inject it — do not rely on a loose `.env`. Silk's install and build
are decoupled, so there is no install hook quietly sourcing env either; CI sets
exactly what each task declares.

## See also

The anti-pattern catalog is at [best-practices](./best-practices.md).
Remote-cache env wiring is at [ci](./ci.md).
