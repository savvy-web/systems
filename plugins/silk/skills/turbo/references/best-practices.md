# Turborepo task-graph best practices

## ^build vs build in dependsOn

The caret matters and is the single most misread part of `dependsOn`:

- `"^build"` — run **build in this package's dependencies first** (topological).
  This is what a normal build wants: `dist/dev` of upstream packages must exist
  before this one compiles.
- `"build"` — run **another task in the same package first** (e.g. a `test` that
  `dependsOn: ["build"]`). No caret means same-package only.

```jsonc
{
  "tasks": {
    "build:prod": { "dependsOn": ["^build:prod"], "outputs": ["dist/prod/**"] },
    "test": { "dependsOn": ["build"] }
  }
}
```

Mixing these up gives you either packages compiling against unbuilt dependencies
(forgot the caret) or a needless full-topology rebuild (added one you didn't
need).

## Transit tasks for parallel-but-correct invalidation

A "transit" task is a near-empty task that exists only to carry dependency edges:
it declares `dependsOn: ["^transit"]` and no real work. Downstream tasks depend on
it so they invalidate when any upstream source changes, while the actual heavy
tasks still run in parallel rather than serializing behind each other. Use this
when you want correct cache invalidation across the graph without forcing a
strict topological chain through every real task.

## Always declare outputs

If a task writes files but its `outputs` glob is missing or wrong, turbo caches
**nothing** to restore — the next "cache hit" replays the log but leaves the
working tree without the artifacts, and the following task fails on a missing
`dist/`. Every build task here declares its real output dir (`dist/dev/**`,
`dist/prod/**`, `meta/**`). The `build:catalog`/`build:meta` tasks are the
exceptions that are deliberately uncached.

## Don't over-broaden globalDependencies

Listing a frequently-touched file (a top-level `README`, a changelog) in
`globalDependencies` busts every package's cache on every unrelated edit. Scope
shared inputs to the configs that genuinely affect output.

## Avoid --parallel for ordered work

`--parallel` ignores `dependsOn` entirely and runs everything at once. It is only
correct for independent tasks (linting every package). Using it for builds races
dependencies and produces flaky, order-dependent failures — let the dependency
graph schedule instead.

## prebuild lifecycle scripts defeat caching

npm `prebuild`/`postbuild` lifecycle scripts run **outside** turbo's hash and
ordering, so their effects are neither cached nor invalidated correctly. Silk
forbids build-in-install hooks for exactly this reason; keep every build step as
a named turbo task, not a lifecycle shim.

## See also

Env-hash correctness is at [environment](./environment.md). Dependency
declaration rules live in the dependency-conventions standard, which is not
bundled with this skill.
