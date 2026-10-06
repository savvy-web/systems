---
type: Module
title: cli
description: The savvy binary — the single command host for the Silk Suite's everyday dev tooling.
kind: package
resource: ../../packages/cli
status: draft
tags: [architecture, tooling]
sources:
  - id: arch
    resource: ../../packages/cli/src
  - id: repos-group
    resource: ../../packages/cli/src/commands/repos
  - id: main
    resource: ../../packages/cli/src/main.ts
  - id: report
    resource: ../../packages/cli/src/internal/report.ts
  - id: failure-line
    resource: ../../packages/cli/src/internal/failure-line.ts
  - id: bin-e2e
    resource: ../../packages/cli/__test__/e2e/bin.e2e.test.ts
  - id: test-utils
    resource: ../../packages/cli/__test__/utils
  - id: boundaries
    resource: ../../packages/cli/__test__/boundaries.test.ts
  - id: layering
    resource: ../../packages/silk/__test__/package-layering.test.ts
  - id: command-error
    resource: ../../packages/cli/src/internal/command-error.ts
  - id: confirm
    resource: ../../packages/cli/src/internal/confirm.ts
  - id: check-section
    resource: ../../packages/cli/src/commands/check-section.ts
  - id: clean
    resource: ../../packages/cli/src/commands/clean.ts
generated:
  by: okfit/claude-code
  at: 2026-10-02T02:45:02Z
  body_sha256: b51ae1f59a269613f3dcbf514847393903648129e337f1d0dad8f5c1c8ea41eb
---

# cli

## Boundary

`@savvy-web/cli` (`packages/cli`) owns the `savvy` binary and its statically-defined command tree — a thin command shell over [`silk-effects`](silk-effects.md), built on Effect v4's in-core `effect/cli` and `@effect/platform-node`. Almost all of its business logic lives in silk-effects: every command handler imports the work it does from there, and this package exists to wire those handlers into one `effect/cli` tree and provide the runtime layer stack that satisfies their service requirements. The lone exception is `savvy clean`, whose filesystem artifact removal has no silk-effects equivalent.[^arch]

It is an L3 front end in the package layering, a peer of [`mcp`](mcp.md) that never imports it — silk's package-layering test asserts this as a layering rule. See [package-layering](../conventions/package-layering.md).[^layering]

The command tree and flag/exit-code contract are documented from the consumer side in [savvy-cli](../interfaces/savvy-cli.md); this concept covers the module's boundary, ownership, and runtime wiring.

## Owner

Bound by [package-layering](../conventions/package-layering.md); shaped by [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md), [silk-pins-siblings-as-dependencies](../decisions/silk-pins-siblings-as-dependencies.md) and [front-ends-adopt-effected-kit](../decisions/front-ends-adopt-effected-kit.md).

## Entry points

The package follows the `./main` contract shared with the MCP server: `src/bin.ts` is the shebang shim, `src/main.ts` owns the process and is exported at `@savvy-web/cli/main`, and `src/index.ts` is the side-effect-free library barrel. `main(options?: MainOptions)` builds `CliAudience.run(rootCommand, { version: CLI_VERSION })` and provides `AppLive` and `CurrentDistribution` once. It then runs `NodeRuntime.runMain(CliRuntime.main(program, { platform: CliPlatform, env, render: FailureLine.render, helpOnUsageError: "stderr" }))`. `rootCommand` shares `CliAudience.flags()` — `--audience <human|agent|ci>`, `--human`, `--agent`, `--ci` — which `CliAudience.run` resolves before core parses (and refuses, at compile time, a root without them). `env` builds the presentation environment once: the audience (overridable through `SAVVY_AUDIENCE`), the terminal (`stderrIsTerminal` passed from `process.stderr.isTTY`, since core's `Stdio` reports only stdout), theme, editor links, the prompt gate, `CliLog` (diagnostics opt-in through `SAVVY_LOG_LEVEL`), and the coloured help formatter whose `formatVersion` is `VersionLine.format`. The formatter is customised through `env.formatter`, never a `CliColor.formatterLayer` in `platform`, which the `env` formatter would shadow. `CliRuntime.main` (`@effected/cli`) provides the platform, reports a failure through the kit logger, applies the `CliExit` code a command set, and exits `64` on a usage error with the help document on stderr beside the error, so stdout stays empty for a caller that parses it.[^main] `FailureLine.render(error, details)` is the renderer. A cancelled prompt (Esc, Ctrl-C) or a prompt refused in a non-interactive run (a pipe, an agent, CI) — `details.isCancelled` or `details.isNotInteractive` — prints the kit's fixed one-line report (`details.defaultLines`) with no issues footer, whichever channel it arrived through; that branch is checked before `isDefect`, because a cancel from a `CliPrompt.fallback` arrives as a defect. Otherwise a typed failure prints as one line (the error's own message, else its tag with its fields, where the kit default `String(error)` would print a bare tag), and a defect — a `die`, a thrown exception — prints the kit's own report (`details.defaultLines`: the status line and the program's stack frames, drawn for the run's audience) followed by the issues URL to file it at.[^failure-line] `MainOptions.distribution` names the carrier the bin was installed through: `@savvy-web/silk` owns a mirror `savvy` bin that imports `@savvy-web/cli/main` and calls `main({ distribution: { name: "@savvy-web/silk", version } })` — the one sanctioned import of cli from silk — so `--version` prints `savvy v<cli> via @savvy-web/silk <silk>`; a direct install prints the bare `savvy v<cli>`. `CLI_VERSION` lives alone in `src/version.ts` so its build-time `process.env` read stays at the edge.[^main]

## The runtime layer stack

The whole service graph is assembled once as `AppLive` in `src/cli/index.ts`, still open on the platform services: `NodeServices.layer` is exported separately as `CliPlatform` and handed to `CliRuntime.main`, so the platform is provided once, at the edge. Four structural choices matter:

- **`provideMerge`, not `provide`**, for base services — so a service such as `Changesets.ConfigInspector` (shared by `BranchAnalyzer`, `ReleasePlanner`, and the `config validate` handler) is built once per run and re-exposed to handlers that yield the tag directly.[^arch]
- **Minimal workspace wiring.** `WorkspaceLive` hand-wires the `WorkspaceRoot`/`WorkspaceDiscovery`/`PackageManagerDetector` trio directly rather than pulling in a batteries-included workspace layer that would fork background work most commands do not need.[^arch]
- **Tool discovery and section management are kit layers**, not silk-effects layers — `ToolDiscovery` from `@effected/commands`, `ManagedSection` from `@effected/templates` — bound to `const`s so each memoizes into one instance per process.[^arch]
- **`DepsRegen` is deliberately NOT in `AppLive`.** Its graph is root-bound at layer *build* time, so binding it once at startup would freeze it to the CLI's launch cwd and ignore a command's `--cwd`; the `deps regen`/`deps detect` handlers instead compose `Changesets.makeDepsRegenDefault({ cwd })` per invocation.[^arch]

## The `savvy repos` command group

`savvy repos` is the CLI half of the vendored-reference-repo lifecycle: one thin handler per `Repos.ReposManager` method plus the `status --drift` reconciliation read. Business logic lives entirely in silk-effects' `Repos` namespace (see [silk-effects](silk-effects.md#repos)); these handlers decode flags, render through `Report`, and set exit codes through `CliExit`.[^repos-group]

Handlers render outcome, not attempt — `restore`'s `stillDirty` names every repo whose worktree is still dirty after the reset ran, and the handler warns and sets a non-zero exit code even though the operation itself completed. `reposCommand` carries a hand-written `Command.Command<...>` type annotation because `Command.withSubcommands` infers a type referencing effect's non-exported `Inspectable` module, which cannot survive declaration emit.[^repos-group]

No raw `Repos` error reaches that annotation. `ReposCli.toCommandError` (`src/commands/repos/shared.ts`) maps every error a `ReposManager` method — or a picker's `status` read — can produce into a `CommandError` carrying a hint for its kind, so the group's error channel is `CommandError | CliError.ShowHelp | Cancelled`. The two exceptions stay outputs, not failures: the friendly missing-manifest line (exit `0`) and `status --json`'s JSON error document. A repo name or other positional left off becomes a picker at a terminal — a `Select` of vendored repos for `pin`/`rename`/`note`/`remove`, of stale registrations for `deregister`, a `MultiSelect` for `restore`, a `Select` for `note promote --into`, and text prompts for `add`'s missing `--ref`/`--purpose` — and a usage error everywhere else, without mounting anything: `ReposCli.missingArgument` fails with core's `CliError.ShowHelp` carrying `MissingArgument`, so the subcommand's help prints on stderr beside the error and the run exits `64`, exactly like a parse error. `restore` and `remove` confirm through `confirmDestructive`, answered by `--yes`; `sync` never prompts.[^repos-group]

## Failures, prompts, and screens

A command that cannot do what it was asked fails with `CommandError` (`src/internal/command-error.ts`): `{ message, detail?, hint?, cause? }`, with `CommandError.from(foreign, { message, hint?, detail? })` wrapping a silk-effects or kit error at the edge, its own description kept as the last detail line. It implements the kit's `CliDoc` protocol, so `FailureLine.render` hands it the kit's report of its document — a failure status line, muted detail, the hint as a tip callout, drawn for the audience — and the run exits `1`. A finding is still output plus `CliExit.set(1)`, never a `CommandError`.[^command-error][^failure-line]

Prompts come from `@effected/cli/ui`, whose `ink` and `react` are this package's regular dependencies (see [cli-carries-ink-for-screens](../decisions/cli-carries-ink-for-screens.md)). JSX lives only in a screen's own `.tsx` module, reached only through a dynamic `import()` on the path that draws — never a static `ink`/`react` import in a command module — so a run that never draws never loads React. `savvy clean`'s view (`src/commands/clean/view.tsx`, named export `cleanView`) is loaded with `import("./clean/view.js")` on the interactive branch only; `CliUi.lazy` is an acceptable alternative but is not used here, and the kit's widgets (`Select`, `Confirm`, `MultiSelect`, `TextInput`) load Ink themselves when they mount. `confirmDestructive({ message, yes })` (`src/internal/confirm.ts`) proceeds without asking on `--yes` (`yesFlag`, `-y`) or when the run cannot prompt — an agent, CI, a pipe — and otherwise shows the kit's `Confirm` screen, where `Enter` alone answers no and Esc fails with `Cancelled` (exit `130`). `savvy init` takes `--lint-preset` from a `Select` at a terminal (else `silk`) and confirms `--force` only when a target file already exists. `savvy clean` draws a live progress view (`CliUi.live`, `src/commands/clean/view.tsx`) only for a person at a terminal; every other run prints per-workspace documents and a total, and targets that could not be removed fail the run as one `CommandError` listing them.[^confirm][^clean] `CliConfigLive` (`src/cli/index.ts`) keeps core's `--help`, `--version`, `--completions` and `--log-level` built-ins and trims its generic `--wizard`, since savvy asks its own questions.[^arch]

`savvy check` runs its three tools without short-circuiting. Each step returns a `CheckSection` (`src/commands/check-section.ts`: a title, blocks, a `success`/`warning`/`failure` verdict, and whether `savvy init` fixes it), and the orchestrator prints them as one document — a collapsible per tool, a `::group::` under GitHub Actions — then a combined summary and, when a section `savvy init` would fix is not clean, a `run savvy init` tip. Any `failure` verdict exits `1`; advisory items stay exit `0`. `savvy init`'s changeset step runs as `runChangesetInit`, which draws its `CommandError` on stderr, sets exit `1` and lets the commit and lint steps still run; `runChangesetInitOrFail` is the failing variant.[^check-section]

## Output, logs, and exit codes

stdout carries only a command's product: human reports built as `@effected/cli` documents through `Report` (`src/internal/report.ts` — `ok ✓`, `warn ⚠`, `fail ✗`, `skip ↷`, `heading`, `detail`, `line`, `verbatim`, and a `summary` reading `3 ok, 1 warning, 2 failed`, or `nothing to do`), JSON documents written with `Console.log`, and hook envelopes written with `process.stdout.write`. `Report.print` is `Doc.print` on stdout, rendered for the run's audience: ANSI for a person at a terminal, plain text for an agent or a pipe, a GitHub Actions log under Actions; only the glyph and headings are painted, and off a terminal nothing is wrapped, so a long path or a `file:line:col` finding survives a grep. A read-only command prints one document; a command that writes files prints one per completed step, so a mid-run failure still shows what was written. Findings stay in that stdout document — never `CliMessage`, whose warning and failure lines go to stderr. Every `Effect.log*` line, including a failure's explanation, goes to stderr as a plain line with no timestamp or level prefix; the separate diagnostics sink is silent unless `SAVVY_LOG_LEVEL` (or core's `--log-level`) sets a level, and writes NDJSON for an agent or CI audience, a pretty line for a person.[^report]

A command reports findings with `CliExit.set(1)` and never touches `process.exitCode` or calls `process.exit`; `CliRuntime.main` owns the exit. A usage error exits `64` with the error and the help on stderr and nothing on stdout, while an explicit `--help` or a bare group invocation prints its help on stdout and exits `0`.[^bin-e2e] `__test__/boundaries.test.ts` pins the exit rule with `@effected/workspaces/testing`'s `SourceBoundary` (`forbidTokens: ["process.exit(", "process.exitCode"]`, any occurrence rather than only a write), confines the build-time `process.env.__PACKAGE_VERSION__` read to `src/version.ts` through an allow rule it asserts was actually waived, and ratchets the files under `src/` that read `process` at all to today's list — a new reader fails the test until it is added deliberately.[^boundaries]

## Testing the command handlers

A handler test runs the handler as `main()` would and asserts on data, never on patched globals. `__test__/utils/capture.ts`'s `Capture.run(effect)` provides the kit-default `CliLogger`, a fresh `CliExit` and a recording `Console`, and returns `{ value, stdout, stderr, exitCode }`; `stdout` holds one entry per printed document, its lines joined by `\n`. `Capture.layer(stdout, stderr)` is the same recording for a test that builds its own layer stack. `Capture.run(effect, { audience, githubActions })` and `Capture.envFor(options)` pick the audience and, under `ci`, the GitHub Actions log format (`::group::` folds and annotations); `Capture.main(effect, { audience?, tty? })` runs the effect through `CliRuntime.main` with `FailureLine.render`, returning the real failure report and exit code. `__test__/utils/interactive.ts`'s `Interactive.run(effect, options?)` forks a handler in a `CliUiTest.session` and returns `{ session, fiber }`: drive the screens through the session, then `Fiber.join` the fiber for the `CaptureResult`; `{ interactive: false }` with `mounts === 0` asserts that an agent, CI or pipe run mounted nothing. Both provide `Capture.env` — `CliEnv.layerTest` fixed to a person's audience on a pipe with no colour, plus `CliLinks` off — so a `Report` renders escape-free and reads nothing of the host's (an inherited `FORCE_COLOR` included); a test that silences logging itself provides `Capture.env` on its own. `Capture.piped` is a `Stdio` whose stdout is not a terminal, for a stack with no platform `Stdio`. `__test__/utils/exit.ts`'s `TestExit` is a per-file `CliExit` cell (`TestExit.layer`, `reset()` in `beforeEach`, `code()`). A test that only needs the handler's return value silences logging with `Layer.merge(Logger.layer([]), Capture.env)`. The capture mechanism decides the runner: `Capture` swaps the `Console` reference and so works under `it.effect`, but a test that spies on the real `console.log` must run under `it.live`, because `it.effect` installs `TestConsole`, which swallows `Console.log` writes before the spy sees them. The built bin is covered by `__test__/e2e/bin.e2e.test.ts`, spawned hermetically through `@effected/cli/testing`'s `CliTest`: the bare `--version` line, a usage error or unknown subcommand exiting `64` with empty stdout, and `--help` and a bare group invocation printing help on stdout, an audience flag accepted on any command, and two audience flags at once exiting `64` with empty stdout. It pins `FORCE_COLOR=0`, since colour follows Node and `FORCE_COLOR` beats `NO_COLOR`.[^test-utils][^bin-e2e]

## Boundaries and invariants

- **`@savvy-web/cli` never imports `@savvy-web/silk` or `@savvy-web/mcp`.** All logic comes from silk-effects; silk's package-layering test asserts the edge never exists.[^layering]
- **No `peerDependencies` block.** The Effect closure is sealed as regular `dependencies` — the same posture as mcp and tsdown-plugins.[^arch]
- **The engine takes its `cwd` from this package.** silk-effects' `ConfigDiscovery` and `BiomeSchemaSync` no longer default to `process.cwd()`; every call passes it explicitly, as the process owner.[^arch]
- **Every hook-section id the CLI declares is spelled UPPERCASE** — a lowercase key does not error but silently grows a duplicate block. See [managed-hook-sections](../interfaces/managed-hook-sections.md).[^arch]
- **`savvy commit hook pre-commit-message` gates its rule set on document kind** — commit-body rules apply only to a real commit message; `plan-leakage` and `closes-trailer` apply to both a commit message and a PR body. See [commit-and-pr-messages](../conventions/commit-and-pr-messages.md).[^arch]
- **`savvy lint fmt <name>` owns argument parsing only** — the byte-format step is a public static shared with the lint-staged handler, never duplicated in the subcommand.[^arch]
- `silk` depends on `cli` as an exact-pinned regular dependency; its `src/bin/savvy.ts` shim is the one sanctioned import of cli from silk. See [silk-pins-siblings-as-dependencies](../decisions/silk-pins-siblings-as-dependencies.md).[^arch]

## Related concepts

- [silk-effects](silk-effects.md) — the engine every command handler delegates to
- [mcp](mcp.md) — the sibling L3 front end
- [savvy-cli](../interfaces/savvy-cli.md) — the command tree and flag/exit-code contract
- [package-layering](../conventions/package-layering.md) — the layering rule this package's non-import invariant enforces

[^arch]: `../../packages/cli/src`
[^repos-group]: `../../packages/cli/src/commands/repos`
[^main]: `../../packages/cli/src/main.ts`
[^report]: `../../packages/cli/src/internal/report.ts`
[^failure-line]: `../../packages/cli/src/internal/failure-line.ts`
[^bin-e2e]: `../../packages/cli/__test__/e2e/bin.e2e.test.ts`
[^test-utils]: `../../packages/cli/__test__/utils`
[^boundaries]: `../../packages/cli/__test__/boundaries.test.ts`
[^layering]: `../../packages/silk/__test__/package-layering.test.ts`
[^command-error]: `../../packages/cli/src/internal/command-error.ts`
[^confirm]: `../../packages/cli/src/internal/confirm.ts`
[^check-section]: `../../packages/cli/src/commands/check-section.ts`
[^clean]: `../../packages/cli/src/commands/clean.ts`
