---
module: silk-effects
category: architecture
status: current
completeness: 90
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./architecture.md
  - ../mcp/architecture.md
  - ../cli/architecture.md
---

# Turbo inspection

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Service and digest](#service-and-digest)
- [Tool discovery is kit-owned](#tool-discovery-is-kit-owned)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`Turbo` (`src/turbo/`, `export * as Turbo`) provides read-only Turborepo introspection. **Every operation invokes `turbo run … --dry=json` and never executes a task** — the load-bearing safety invariant of the namespace. It exists to back the MCP `turbo_inspect` tool (`../mcp/architecture.md`); the cache-miss and graph reasoning lives here so the tool file stays glue.

## Current state

Implemented; unit tests over the pure digest and an integration test against a fixture turbo repo in `__test__/integration/TurboInspector.int.test.ts`.

## Service and digest

The namespace splits into a service for I/O and a pure transformer for the math. `TurboInspector` (`services/TurboInspector.ts`, a `Context.Service`) exposes cache diagnosis (per-package hit/miss with hash-contributor breakdown per miss), the task graph with its critical path and the affected set (changed packages plus dependents), all failing with the `TurboError` union in `errors.ts` — `TurboNotInstalledError` and `TurboExecError` are distinct so a caller can tell "turbo absent" from "turbo ran and failed". `TurboDigest` (`digest.ts`, all-static) holds the pure transforms from a decoded `TurboDryRun` into the result shapes, with no DI.

The `layer` requires the kit `ToolDiscovery` plus `ChildProcessSpawner | FileSystem | Git`; the spawner is captured at construction and re-provided onto each `Run` effect, so the public methods stay `R = never`. Methods take an explicit `cwd` (the MCP handler resolves the workspace root); the layer guards on a `turbo.json` there (`NotATurboRepoError`) before resolving the binary via `Tool.named("turbo")`.

Schemas (`schemas/`): `TurboDryRun` decodes `--dry=json`; the result structs are deliberately **flat and recursion-free** so the MCP's Effect-Schema→zod bridge round-trips them.

## Tool discovery is kit-owned

Locating a binary on `PATH` or through the package manager, extracting versions and caching probes is `@effected/commands`' `ToolDiscovery`. `Tool.named("turbo")` builds the definition, `discovery.resolve(tool)` yields a `ResolvedTool` whose `command(...)` returns a core `ChildProcess.Command`, and the `Run` free functions execute it. Its `LocalExec` contract — the argv prefix that runs a project-local binary — is supplied by `@effected/workspaces`' `Workspaces.localExecLayer()`; see `../cli/architecture.md` and `../mcp/architecture.md` for how each host wires it. The kit's resolution failure is a union whose members expose no `reason` field, so `TurboNotInstalledError` is built from `e.message`.

**Environment extension goes through `Run.extendEnv`, never core's bare `setEnv`.** `ChildProcess.setEnv` *replaces* the child environment rather than merging onto the parent's, so a command given one extra variable loses `PATH` and fails to spawn. The integration test pins this: if it ever stops failing when `extendEnv` is swapped back to `setEnv`, the pin has rotted.

## Rationale

### Why `--dry=json` only

An inspection tool that can run tasks is a footgun in an agent's hands. Keeping the whole namespace on dry runs makes the safety property structural rather than a per-call flag.

### Why split the service from the digest

The transforms are the interesting logic and are pure; keeping them off the service makes them directly unit-testable against fixture JSON without a spawner or a real turbo binary.

## Related documentation

- [Architecture overview](./architecture.md)
- [`../mcp/architecture.md`](../mcp/architecture.md) — the `turbo_inspect` tool
- [`../cli/architecture.md`](../cli/architecture.md) — `ToolDiscovery` wiring in the CLI host
