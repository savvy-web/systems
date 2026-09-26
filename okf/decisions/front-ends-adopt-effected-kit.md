---
type: Decision
title: The savvy front ends adopt the effected front-end kit
description: "@savvy-web/cli, @savvy-web/mcp and silk's carrier shims run on @effected/engine, @effected/cli and @effected/mcp, and the layering and source-boundary guards on @effected/workspaces/testing, in place of process wiring this repository hand-rolled; mcp registers its toolkit through McpToolkit and its crash guards through McpGuard, and cli results move to a local Output helper on stdout."
status: draft
tags: [architecture, deps, tooling]
sources:
  - id: okfit-precedent
    resource: https://github.com/spencerbeggs/okfit/blob/main/okf/decisions/front-ends-adopt-the-effected-kit.md
    title: okfit's front ends build on @effected/{engine,cli,mcp} rather than hand-rolled equivalents
  - id: issue
    resource: https://github.com/savvy-web/systems/issues/695
  - id: issue-700
    resource: https://github.com/savvy-web/systems/issues/700
  - id: cli-failure-line
    resource: ../../packages/cli/src/internal/failure-line.ts
  - id: cli-bin-e2e
    resource: ../../packages/cli/__test__/e2e/bin.e2e.test.ts
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
  - id: mcp-repos-manage
    resource: ../../packages/mcp/src/tools/repos-manage.ts
  - id: mcp-harness
    resource: ../../packages/mcp/__test__/utils/harness.ts
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
  at: 2026-09-26T22:54:36Z
  body_sha256: 9f69e3accb8bb17b56530c5b00598dd168964d3f9ebfef29dba17cd68fdd862a
---

# The savvy front ends adopt the effected front-end kit

## Context

`@savvy-web/cli` and `@savvy-web/mcp` each hand-assembled their own process edge: the CLI wrote `process.exitCode` directly from command handlers and printed its human results as `Effect.log` lines, and the MCP server hand-wired `McpServer.layerStdio`, a `Logger.LogToStderr` provide, a stdin-EOF teardown, a `resolveProjectDir` precedence chain and its own remediation helpers. The layering guard was a hand-rolled DAG walker in a dedicated `@e2e/workspace` harness package. The `@effected` kit shipped a front-end layer distilled from exactly this duplication across its consumers — `@effected/engine` (`Distribution`, `LaunchContext`, `Remediation`, `CurrentDistribution`), `@effected/cli` (`CliRuntime`, `CliExit`, `CliLogger`, `CliColor`), `@effected/mcp` (`McpStdio`, `ToolFailure`, plus `McpHarness`/`McpProcess`/`McpProbe` under `/testing`) and `@effected/workspaces/testing` (`SourceBoundary`, `LayerPolicy`, `WorkspaceLayering`) — and the sibling `okfit` repository adopted it first.[^okfit-precedent] Implemented against savvy-web/systems#695.[^issue]

## Decision

Adopt the kit at `@effected/engine` 0.1.0, `@effected/mcp` 0.1.1, `@effected/cli` 0.8.0 and `@effected/workspaces` 0.26.0 across both front ends, silk's carrier shims, and the repository's structural guards.[^issue] savvy-web/systems#700 then retired the pieces this adoption had kept local, as the kit grew them in `@effected/mcp` 0.2.0, `@effected/cli` 0.9.0 and `@effected/workspaces` 0.27.0: the mcp crash guards, the hand-ported in-process harness, the flat `repos_manage` wire schema, the tool-local refusal errors, the hand exit-write regex, and help-on-stdout for a usage error.[^issue-700] The paragraphs below describe the result.

**cli.** `main.ts` runs `NodeRuntime.runMain(CliRuntime.main(program, { platform, render: FailureLine.render, helpOnUsageError: "stderr" }))` with the kit-default `CliLogger`: every log line goes to stderr, with no timestamp or level prefix. `NodeServices` moved out of `AppLive` into `CliPlatform`, and `platform` is `VersionFormatterLive` merged over `CliPlatform`, so the platform and the version formatter are provided once at the edge — the formatter must ride in `platform`, since help routing only sees a formatter provided there. A command reports findings by `CliExit.set(1)`; `CliRuntime.main` owns the process exit and turns a usage error into exit `64` with the error and the help on stderr and stdout empty, while an explicit `--help` or a bare group invocation keeps its help on stdout and exits `0`.[^cli-main][^cli-bin-e2e] `FailureLine.render(error, { cause, isDefect })` renders what the kit reports: a typed failure as one line (its message, or its tag and fields, where the kit default `String(error)` would print a bare tag), and a defect as an issue report — a headline, the `Cause.pretty` cause with its stack, and the issues URL.[^cli-failure-line] The human result a command prints goes through a local `Output` helper (`src/internal/output.ts`: `ok ✓`, `warn ⚠`, `fail ✗`, `skip •`, `heading`, `detail`, `line`, `summary`) that writes to stdout via `Console.log`, tinting only the glyph or heading, and only when `CliColor.enabled` holds (stdout a TTY and `NO_COLOR` unset).[^cli-output] `--version` renders through `CliColor.formatterLayer` as `savvy v<version>`, plus `via <carrier> <version>` when a `Distribution` was passed in.[^cli-main] A source-boundary test forbids any use of `process.exit(` or `process.exitCode` under `src/` through `SourceBoundary`'s `forbidTokens`, confines `process.env.__PACKAGE_VERSION__` to `version.ts`, and ratchets the files that read `process` at all.[^cli-boundaries]

**mcp.** `main.ts` resolves the project directory with `LaunchContext.projectDir` — the first positional argument, then `SAVVY_MCP_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR`, then the working directory, skipping an empty value or an unsubstituted `${VAR}` placeholder. That resolution runs inside `@effected/mcp/guard`'s `McpGuard.run({ label: "savvy-mcp", host: process, load })`. The guard registers the `uncaughtException`/`unhandledRejection` listeners, then awaits `load`, which dynamically imports the whole server graph and returns the layer and `NodeRuntime.runMain`; the guard launches it through `McpStdio.launch` with `McpStdio.teardown`, so an import-time failure is reported on stderr and a rejected `load` exits 1.[^mcp-main] `ServerLayer` builds on `McpStdio.layer`, which supplies the kit's default protocol list (the stateless `2026-07-28` adapter first, then `2025-11-25` and `2025-06-18`), merges `LogToStderr`, answers a non-JSON stdin line with `-32700` and keeps serving, and applies `Layer.orDie`; `serverInfo.version` carries the same distribution suffix as the CLI.[^mcp-server] The toolkit registers through `McpToolkit.layer(SilkToolkit, { strict: "annotated" })`, so success rendering is core's (`structuredContent` plus the same object as JSON in `content[0].text`) and, with no tool annotated `Tool.Strict`, every `Tool.make` tool stays lenient — Claude Code sends `_meta`-style extras on some calls. Registration moved onto the kit in savvy-web/systems#688, which retired the local `registerToolkit` port and its markdown text channel; the reasons are recorded in [effect-native-mcp-server](effect-native-mcp-server.md).[^issue-688] `McpToolError` is `WorkspaceNotFound | EngineError | BiomeFailed | ToolRefusal`: the three local tagged errors carry a field of their own and spread `ToolFailure.fields`, composing their messages through `ToolFailure.message` and `ToolFailure.truncate`, and a plain refusal is the kit's `ToolRefusal.refuse(reason, remediation)` — `InvalidArgument` and `BiomeUnavailable` are removed.[^mcp-errors] `repos_manage` is a `McpToolkit.unionTool`, served as a strict `oneOf` keyed by `action` and decoded by `McpToolkit.unionHandler`, and the four union results are wrapped in `ToolOutputSchema.objectRooted`, so every tool serves an `outputSchema`.[^mcp-repos-manage] The in-process tests drive the server through `@effected/mcp/testing`'s `McpHarness` behind a thin local `makeHarness` plus `PlatformWithoutStdio`.[^mcp-harness]

**silk.** Both carrier shims call `main({ distribution: { name: "@savvy-web/silk", version } })`, with silk's own build-time version, so a bin launched through the carrier names it in `--version` and in `serverInfo.version`. silk gains no runtime dependency.[^silk-bins]

**Guards.** The layering policy moved to `packages/silk/layers.json` on the kit's `LayerPolicy` schema, checked by `WorkspaceLayering.checkWorkspace` in `packages/silk/__test__/package-layering.test.ts`; `@e2e/workspace` is deleted.[^layering-test] `SourceBoundary` pins silk's half of the non-import invariant at source (only the two `src/bin` shims import `@savvy-web/cli`/`@savvy-web/mcp`) and the "only `bin.ts`/`main.ts`/`version.ts` touch `process`" rule in mcp; the cli↔mcp direction is held by the layering test, where an edge between the two L3 packages is a `sameLayer` offence.

### The stdout contract

On the CLI, stdout carries only what a caller ran the command to get: the `Output` result lines, JSON documents (`Console.log`), and hook envelopes (`process.stdout.write`). Every `Effect.log*` line, including a failure's explanation, goes to stderr, and so does the help a usage error prints. One case is deliberately doubled: `savvy repos status --json` hitting a config error prints `{ "error": ..., "clean": false }` to stdout as well as logging the message, because the gitmodules-drift monitor `JSON.parse`s that stream and must never receive an empty one.[^cli-main]

## Alternatives rejected

- **Swap only the logger, with `stderrFrom: "Error"`.** Keeping `Effect.log` as the result channel and routing only error-level lines to stderr would have left diagnostics and product interleaved on stdout, with log formatting on every result line and nothing a script could pipe cleanly. The kit default (every log line on stderr) plus an explicit result channel makes the split structural.[^cli-main]
- **Kit-hosted output helpers through a dogfood round.** Growing `@effected/cli` an `Output` equivalent first would have meant a linked `file:` override round, which blocks pushing this branch, for a helper whose shape was still being discovered across the command groups. The helper is local and `@internal` instead; it can move upstream once its shape settles.[^cli-output]
- **Keep the hand-rolled edges.** This is the status quo the Context describes; the kit's stdin guard and placeholder-skipping project-dir resolution are fixes the hand-rolled code did not have.[^okfit-precedent]

## Consequences

- **Exit codes:** `0` success, `1` findings (set through `CliExit`), `64` usage error with stdout empty. A test asserts on a `CliExit` cell (`__test__/utils/exit.ts`, `__test__/utils/capture.ts`), never on `process.exitCode`.[^cli-boundaries]
- **A script that scraped savvy's log lines from stdout now sees them on stderr.** The documented result lines replace them on stdout; `--json` remains the stable machine surface. See [savvy-cli](../interfaces/savvy-cli.md).
- **Shared bin names, and who owns the `.bin` slot.** cli and mcp keep declaring their own `savvy`/`savvy-mcp` bins beside silk's, so a manager chooses which package's bin a user typing the name gets. As observed in the packed-install e2e: pnpm links only the consumer's direct dependency and writes its own shim to silk's bin, so the suffix shows. npm and bun give the slot to cli/mcp, so the typed bin prints no `via @savvy-web/silk` suffix. Yarn gives it to silk. The carrier's own shims print the suffix on all four managers, and that is what the e2e asserts everywhere, through `PackedInstall`'s `runCarrierBin`/`carrierCommand` with `allowSharedBins: true`. The shared bins are kept deliberately (savvy-web/systems#700 item 10). Making silk the only owner would mean dropping `bin` from cli and mcp — a major bump of both — which [carrier-pattern-package-graph](carrier-pattern-package-graph.md) left untaken.[^packed-install][^issue-700]
- **Layering semantics are the kit's.** An edge counts wherever a dependency name is a workspace package, in all four dependency fields, not only `workspace:` specifiers; see [layers-json](../interfaces/layers-json.md) and [package-layering](../conventions/package-layering.md).[^layering-test]
- A future `effect` rc bump re-pins through the kit rather than re-deriving stdio, teardown and exit wiring in two places here.

[^okfit-precedent]: <https://github.com/spencerbeggs/okfit/blob/main/okf/decisions/front-ends-adopt-the-effected-kit.md>
[^issue]: <https://github.com/savvy-web/systems/issues/695>
[^issue-700]: <https://github.com/savvy-web/systems/issues/700>
[^cli-failure-line]: `../../packages/cli/src/internal/failure-line.ts`
[^cli-bin-e2e]: `../../packages/cli/__test__/e2e/bin.e2e.test.ts`
[^cli-main]: `../../packages/cli/src/main.ts`
[^cli-output]: `../../packages/cli/src/internal/output.ts`
[^cli-boundaries]: `../../packages/cli/__test__/boundaries.test.ts`
[^mcp-main]: `../../packages/mcp/src/main.ts`
[^mcp-server]: `../../packages/mcp/src/server.ts`
[^mcp-errors]: `../../packages/mcp/src/errors.ts`
[^mcp-repos-manage]: `../../packages/mcp/src/tools/repos-manage.ts`
[^mcp-harness]: `../../packages/mcp/__test__/utils/harness.ts`
[^issue-688]: <https://github.com/savvy-web/systems/issues/688>
[^silk-bins]: `../../packages/silk/src/bin`
[^layering-test]: `../../packages/silk/__test__/package-layering.test.ts`
[^packed-install]: `../../e2e/silk/__test__/e2e/packed-install.e2e.test.ts`
