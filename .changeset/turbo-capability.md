---
"@savvy-web/silk-effects": minor
"@savvy-web/mcp": minor
---

## Features

### `Turbo` namespace in `@savvy-web/silk-effects`

Adds a read-only Turborepo inspection namespace alongside `Changesets` / `Commitlint` / `Lint`, built on the existing `ToolDiscovery` / `ToolCommand` so package-manager resolution is inherited. Every operation uses `turbo --dry` and never executes tasks.

New exports under `Turbo`:

* `TurboInspector` service + `TurboInspectorLive` layer with `diagnoseCache(task, cwd)`, `taskGraph(cwd, task?)`, and `affected(cwd, base?)`.
* `TurboDigest` — pure transforms from decoded `--dry=json` output to digested results (per-package hit/miss, per-miss hash-contributor breakdown, global-hash summary, critical path).
* Result schemas `CacheDiagnosis`, `TaskGraphResult`, `AffectedResult`, the `TurboDryRun` input schema, and the tagged errors `TurboNotInstalledError`, `NotATurboRepoError`, `DryRunParseError`, `TurboExecError`.

### `turbo_inspect` MCP tool and `standards/turbo` corpus in `@savvy-web/mcp`

* New `turbo_inspect` tool registered beside `workspace_info` and `silk_docs_search`. It takes `mode` (`cache` | `graph` | `affected`) plus optional `task` / `base` / `cwd`, resolves the workspace root, and surfaces the `Turbo` namespace as a discriminated-union result projected to markdown. Read-only.
* `mode: cache` diagnoses why a task's cache is hitting or missing, reporting per-package status and the exact hash contributors (input files, env vars, external-dependency hashes, and the global hash). `mode: graph` returns the task graph and critical path. `mode: affected` lists changed packages and their dependents.
* New `silk://standards/turbo/*` corpus docs (ci, filtering, environment, best-practices, watch, boundaries), searchable via `silk_docs_search`. Because all three plugins spawn the shared `savvy-mcp` server, they all gain the tool and docs.

The `silk` plugin gains a `turbo` front-door skill and a `turborepo` agent that drive `turbo_inspect`.
