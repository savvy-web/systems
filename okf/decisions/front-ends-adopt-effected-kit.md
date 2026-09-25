---
type: Decision
title: The savvy front ends adopt the effected front-end kit
description: "@savvy-web/cli, @savvy-web/mcp and silk's carrier shims run on @effected/engine, @effected/cli and @effected/mcp, and the layering and source-boundary guards on @effected/workspaces/testing, in place of process wiring this repository hand-rolled; mcp registers its toolkit through McpToolkit, the mcp crash guards are kept, and cli results move to a local Output helper on stdout."
status: draft
tags: [architecture, deps, tooling]
sources:
  - id: okfit-precedent
    resource: https://github.com/spencerbeggs/okfit/blob/main/okf/decisions/front-ends-adopt-the-effected-kit.md
    title: okfit's front ends build on @effected/{engine,cli,mcp} rather than hand-rolled equivalents
  - id: issue
    resource: https://github.com/savvy-web/systems/issues/695
  - id: cli-main
    resource: ../../packages/cli/src/main.ts
  - id: cli-output
    resource: ../../packages/cli/src/internal/output.ts
  - id: cli-boundaries
    resource: ../../packages/cli/__test__/boundaries.test.ts
  - id: mcp-main
    resource: ../../packages/mcp/src/main.ts
  - id: mcp-server
    resource: ../../packages/mcp/src/server.ts
  - id: mcp-errors
    resource: ../../packages/mcp/src/errors.ts
  - id: issue-688
    resource: https://github.com/savvy-web/systems/issues/688
  - id: silk-bins
    resource: ../../packages/silk/src/bin
  - id: layering-test
    resource: ../../packages/silk/__test__/package-layering.test.ts
  - id: packed-install
    resource: ../../e2e/silk/__test__/e2e/packed-install.e2e.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-25T02:44:37Z
  body_sha256: 38f8896c6e780aa2658fe2ddececa25dec9a2dbba834a95421da4d5ea17123b2
---

# The savvy front ends adopt the effected front-end kit

## Context

`@savvy-web/cli` and `@savvy-web/mcp` each hand-assembled their own process edge: the CLI wrote `process.exitCode` directly from command handlers and printed its human results as `Effect.log` lines, and the MCP server hand-wired `McpServer.layerStdio`, a `Logger.LogToStderr` provide, a stdin-EOF teardown, a `resolveProjectDir` precedence chain and its own remediation helpers. The layering guard was a hand-rolled DAG walker in a dedicated `@e2e/workspace` harness package. The `@effected` kit shipped a front-end layer distilled from exactly this duplication across its consumers — `@effected/engine` (`Distribution`, `LaunchContext`, `Remediation`, `CurrentDistribution`), `@effected/cli` (`CliRuntime`, `CliExit`, `CliLogger`, `CliColor`), `@effected/mcp` (`McpStdio`, `ToolFailure`, plus `McpHarness`/`McpProcess`/`McpProbe` under `/testing`) and `@effected/workspaces/testing` (`SourceBoundary`, `LayerPolicy`, `WorkspaceLayering`) — and the sibling `okfit` repository adopted it first.[^okfit-precedent] Implemented against savvy-web/systems#695.[^issue]

## Decision

Adopt the kit at `@effected/engine` 0.1.0, `@effected/mcp` 0.1.1, `@effected/cli` 0.8.0 and `@effected/workspaces` 0.26.0 across both front ends, silk's carrier shims, and the repository's structural guards.[^issue]

**cli.** `main.ts` runs `NodeRuntime.runMain(CliRuntime.main(program, { platform: CliPlatform, render: FailureLine.render }))` with the kit-default `CliLogger` (`FailureLine` renders a propagated failure by its message, or its tag and fields, where the kit default `String(error)` would print a bare tag): every log line goes to stderr, with no timestamp or level prefix. `NodeServices` moved out of `AppLive` into `CliPlatform`, so the platform is provided once at the edge. A command reports findings by `CliExit.set(1)`; `CliRuntime.main` owns the process exit and turns a usage error into exit `64` (help on stdout, the error on stderr).[^cli-main] The human result a command prints goes through a local `Output` helper (`src/internal/output.ts`: `ok ✓`, `warn ⚠`, `fail ✗`, `skip •`, `heading`, `detail`, `line`, `summary`) that writes to stdout via `Console.log`, tinting only the glyph or heading, and only when `CliColor.enabled` holds (stdout a TTY and `NO_COLOR` unset).[^cli-output] `--version` renders through `CliColor.formatterLayer` as `savvy v<version>`, plus `via <carrier> <version>` when a `Distribution` was passed in.[^cli-main] A source-boundary test forbids any `process.exitCode` write or `process.exit` call under `src/` and ratchets the files that read `process` at all.[^cli-boundaries]

**mcp.** `main.ts` resolves the project directory with `LaunchContext.projectDir` — the first positional argument, then `SAVVY_MCP_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR`, then the working directory, skipping an empty value or an unsubstituted `${VAR}` placeholder — and runs `NodeRuntime.runMain(McpStdio.launch(ServerLayer(cwd, options)), { teardown: McpStdio.teardown })`.[^mcp-main] `ServerLayer` builds on `McpStdio.layer`, which supplies the kit's default protocol list (the stateless `2026-07-28` adapter first, then `2025-11-25` and `2025-06-18`), merges `LogToStderr`, answers a non-JSON stdin line with `-32700` and keeps serving, and applies `Layer.orDie`; `serverInfo.version` carries the same distribution suffix as the CLI.[^mcp-server] The toolkit registers through `McpToolkit.layer(SilkToolkit, { strict: "annotated" })`, so success rendering is core's (`structuredContent` plus the same object as JSON in `content[0].text`) and, with no tool annotated `Tool.Strict`, every tool stays lenient — Claude Code sends `_meta`-style extras on some calls. Registration moved onto the kit in savvy-web/systems#688, which retired the local `registerToolkit` port and its markdown text channel; the reasons are recorded in [effect-native-mcp-server](effect-native-mcp-server.md).[^issue-688] The five tagged errors spread `ToolFailure.fields` and compose their messages through `ToolFailure.message` and `ToolFailure.truncate`, so the local remediation helpers left the public barrel.[^mcp-errors]

**silk.** Both carrier shims call `main({ distribution: { name: "@savvy-web/silk", version } })`, with silk's own build-time version, so a bin launched through the carrier names it in `--version` and in `serverInfo.version`. silk gains no runtime dependency.[^silk-bins]

**Guards.** The layering policy moved to `packages/silk/layers.json` on the kit's `LayerPolicy` schema, checked by `WorkspaceLayering.checkWorkspace` in `packages/silk/__test__/package-layering.test.ts`; `@e2e/workspace` is deleted.[^layering-test] `SourceBoundary` pins silk's half of the non-import invariant at source (only the two `src/bin` shims import `@savvy-web/cli`/`@savvy-web/mcp`) and the "only `bin.ts`/`main.ts`/`version.ts` touch `process`" rule in mcp; the cli↔mcp direction is held by the layering test, where an edge between the two L3 packages is a `sameLayer` offence.

### The stdout contract

On the CLI, stdout carries only what a caller ran the command to get: the `Output` result lines, JSON documents (`Console.log`), and hook envelopes (`process.stdout.write`). Every `Effect.log*` line, including a failure's explanation, goes to stderr. One case is deliberately doubled: `savvy repos status --json` hitting a config error prints `{ "error": ..., "clean": false }` to stdout as well as logging the message, because the gitmodules-drift monitor `JSON.parse`s that stream and must never receive an empty one.[^cli-main]

### What was kept, and why

- **The mcp crash guards.** The kit does not package the "register `uncaughtException`/`unhandledRejection`, then dynamically import the server graph" pattern, so `main.ts` keeps it verbatim ahead of `McpStdio.launch`.[^mcp-main]

## Alternatives rejected

- **Swap only the logger, with `stderrFrom: "Error"`.** Keeping `Effect.log` as the result channel and routing only error-level lines to stderr would have left diagnostics and product interleaved on stdout, with log formatting on every result line and nothing a script could pipe cleanly. The kit default (every log line on stderr) plus an explicit result channel makes the split structural.[^cli-main]
- **Kit-hosted output helpers through a dogfood round.** Growing `@effected/cli` an `Output` equivalent first would have meant a linked `file:` override round, which blocks pushing this branch, for a helper whose shape was still being discovered across the command groups. The helper is local and `@internal` instead; it can move upstream once its shape settles.[^cli-output]
- **Keep the hand-rolled edges.** This is the status quo the Context describes; the kit's stdin guard and placeholder-skipping project-dir resolution are fixes the hand-rolled code did not have.[^okfit-precedent]

## Consequences

- **Exit codes:** `0` success, `1` findings (set through `CliExit`), `64` usage error. A test asserts on a `CliExit` cell (`__test__/utils/exit.ts`, `__test__/utils/capture.ts`), never on `process.exitCode`.[^cli-boundaries]
- **A script that scraped savvy's log lines from stdout now sees them on stderr.** The documented result lines replace them on stdout; `--json` remains the stable machine surface. See [savvy-cli](../interfaces/savvy-cli.md).
- **The npm `.bin` limitation.** Under npm's flat hoist, `node_modules/.bin/savvy` and `savvy-mcp` may link to the cli or mcp package's own bin instead of silk's shim, so the `via @savvy-web/silk` suffix is guaranteed only under pnpm; the packed-install e2e asserts it for pnpm only. Making it hold under npm would need the front ends to stop declaring `bin`, the product decision [carrier-pattern-package-graph](carrier-pattern-package-graph.md) left untaken.[^packed-install]
- **Layering semantics are the kit's.** An edge counts wherever a dependency name is a workspace package, in all four dependency fields, not only `workspace:` specifiers; see [layers-json](../interfaces/layers-json.md) and [package-layering](../conventions/package-layering.md).[^layering-test]
- A future `effect` rc bump re-pins through the kit rather than re-deriving stdio, teardown and exit wiring in two places here.

[^okfit-precedent]: <https://github.com/spencerbeggs/okfit/blob/main/okf/decisions/front-ends-adopt-the-effected-kit.md>
[^issue]: <https://github.com/savvy-web/systems/issues/695>
[^cli-main]: `../../packages/cli/src/main.ts`
[^cli-output]: `../../packages/cli/src/internal/output.ts`
[^cli-boundaries]: `../../packages/cli/__test__/boundaries.test.ts`
[^mcp-main]: `../../packages/mcp/src/main.ts`
[^mcp-server]: `../../packages/mcp/src/server.ts`
[^mcp-errors]: `../../packages/mcp/src/errors.ts`
[^issue-688]: <https://github.com/savvy-web/systems/issues/688>
[^silk-bins]: `../../packages/silk/src/bin`
[^layering-test]: `../../packages/silk/__test__/package-layering.test.ts`
[^packed-install]: `../../e2e/silk/__test__/e2e/packed-install.e2e.test.ts`
