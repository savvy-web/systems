# Turborepo watch and persistent tasks

## Rule

`turbo watch <task>` re-runs a task across the workspace whenever its inputs
change, respecting the dependency graph — an edit in a library re-triggers its
dependents in topological order. This is distinct from a framework's own watcher:
turbo watch coordinates the **graph**, the per-package tool handles incremental
recompilation inside one package.

```bash
turbo watch build:dev          # rebuild dev artifacts on change, in dep order
turbo watch test --filter=@savvy-web/mcp...
```

## Persistent (dev) tasks

A long-running process — a dev server, a `tsc --watch`, a sidecar — is a
**persistent** task. Mark it so turbo never treats its exit as task completion
and never tries to cache it:

```jsonc
{
  "tasks": {
    "dev": { "persistent": true, "cache": false }
  }
}
```

A persistent task may not appear in another task's `dependsOn` (it never
finishes, so nothing downstream could ever start). Model a needed background
service as a separate persistent task you start alongside, not as a dependency
edge.

## Interactive tasks

Tasks that need a TTY (prompts, REPLs) must opt in with `"interactive": true` so
turbo gives them stdin and does not multiplex their output. Reserve this for
genuinely interactive tooling; most CI tasks should stay non-interactive so logs
stream cleanly.

## Caveats

- Watch mode shines for iteration, not validation. CI still runs discrete
  `turbo run` tasks so every step is hashed and cacheable.
- Newly added or deleted files may need a watcher restart if a tool's own
  watcher does not pick up tree changes.
- `cache: false` on persistent tasks is required; a cached "dev server" is
  meaningless and turbo will warn.

## See also

The persistent-task / `dependsOn` interaction is covered under outputs and
parallelism at [best-practices](./best-practices.md). Scoping watch to a subset
uses the syntax at [filtering](./filtering.md).
