---
type: Decision
title: The lint-staged boundary stays plain-function and shares tool discovery through the kit's sync facades
description: "silk-effects' Lint handlers stay synchronous plain functions with no Effect runtime, and Lint's Command utility is a thin wrapper over @effected/workspaces' detectPackageManagerSync and @effected/commands' makeToolDiscoverySync, so the lint-staged path and the Effect services share one tool-discovery implementation without a second copy or a per-invocation runtime."
status: draft
tags: [architecture, tooling, deps]
generated:
  by: okfit/claude-code
  at: 2026-10-25T21:06:42Z
sources:
  - id: command
    resource: ../../packages/silk-effects/src/lint/utils/Command.ts
  - id: lint
    resource: ../../packages/silk-effects/src/lint
  - id: issue
    resource: https://github.com/savvy-web/systems/issues/471
  - id: kit-issue
    resource: https://github.com/spencerbeggs/effected/issues/1100
  - id: kit-pr
    resource: https://github.com/spencerbeggs/effected/pull/1101
  - id: yaml-review
    resource: https://github.com/savvy-web/systems/pull/467
integrity:
  generated:
    body: ed331de84c935a6f
---

# The lint-staged boundary stays plain-function and shares tool discovery through the kit's sync facades

## Context

The `Lint` namespace (`packages/silk-effects/src/lint/`) is the lint-staged integration layer. lint-staged imports its handlers (`Biome`, `Markdown`, `TypeScript`, `PackageJson`, `PnpmWorkspace`, `Yaml` and the rest) and calls them as plain functions on every commit, over every staged file, so there is no Effect runtime to provide a layer to and the handlers are synchronous by contract.[^lint]

Every handler finds its tool through `Command` (`findTool`/`requireTool`, `findSavvyLint`). `Command` used to be a second, hand-rolled implementation of tool discovery and package-manager detection on `node:child_process` `execSync` and `node:fs`, with its own caches, alongside the kit's `ToolDiscovery` and `PackageManagerDetector` services that the cli already wires. The two had to track each other by hand as the ecosystem moved.[^issue] The same tension had surfaced on #467, where routing only the YAML handler's I/O through Effect's `FileSystem` was declined because it would have made one handler the only one needing a runtime.[^yaml-review]

## Decision

Keep the plain-function, synchronous boundary, and make `Command` a thin wrapper over the kit's synchronous facades so the logic exists once:[^command]

- `detectPackageManager` delegates to `@effected/workspaces`' `detectPackageManagerSync` (with `nodeSyncOps`), falling back to `npm` when nothing names a manager.
- `isAvailable`, `findTool` and `requireTool` resolve through one memoized `makeToolDiscoverySync` from `@effected/commands`, spawning with `nodeSpawnSync`. `findTool` asks for `prefer: "global"`, which keeps the global-first resolution order the handlers relied on.
- Exec prefixes (`getExecPrefix`, and the discovery's exec context) come from `LocalExec.contextFor`.
- `clearCache` drops the discovery and calls its `invalidateAll`.
- `exec` and `execSilent`, which no in-repo code calls, are deprecated for removal in a future major.

The sync facades were added to the kit for this purpose (spencerbeggs/effected#1100, PR #1101) and adopted through a dogfood round. They are the kit's own implementation exposed synchronously, so lint-staged and the Effect services share discovery rules while keeping their different calling conventions.[^kit-issue][^kit-pr]

## Alternatives rejected

- **Leave two implementations and document the boundary.** This was the cheapest option and kept the contract, but `Command`'s hand-rolled `findTool` carried its own idea of package-manager detection and exec prefixes, and that would have drifted from the kit's with nothing to catch it.[^issue]
- **Make the handlers Effect programs run through a per-invocation runtime at the lint-staged boundary.** This would have removed the duplication and given typed failures, but it meant rewriting every handler and its tests and building a runtime on a hot path that runs on every commit for every staged file, where none runs today.[^issue]

## Consequences

- The lint-staged handlers stay plain functions. Do not convert one handler to an Effect program by itself: a runtime for one handler only is worse than the consistent plain-function boundary.
- Tool-discovery and package-manager-detection behaviour now follows the kit. Detection order is `devEngines`, then `packageManager`, then lockfile and workspace markers. `getExecPrefix("npm")` ends in a trailing `--`. `isAvailable` probes the tool directly instead of running `command -v` through a shell. Change these rules in the kit, not in `Command`.
- `Command` still owns two things the kit does not cover: `findRoot` (walk up to the nearest `package.json`) and `findSavvyLint`'s fallback to the cli's dev build for dogfooding.[^command]

## Related

- [silk-effects](../modules/silk-effects.md): the `Lint` namespace this decision bounds.
- [front-ends-adopt-effected-kit](front-ends-adopt-effected-kit.md): the matching move for the cli and mcp front ends, which do run an Effect runtime.

[^command]: `../../packages/silk-effects/src/lint/utils/Command.ts`
[^lint]: `../../packages/silk-effects/src/lint`
[^issue]: <https://github.com/savvy-web/systems/issues/471>
[^kit-issue]: <https://github.com/spencerbeggs/effected/issues/1100>
[^kit-pr]: <https://github.com/spencerbeggs/effected/pull/1101>
[^yaml-review]: <https://github.com/savvy-web/systems/pull/467>
