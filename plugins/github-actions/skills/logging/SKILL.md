---
name: logging
description: >
  Beautiful run logs for GitHub Actions built on
  @savvy-web/github-action-effects — the Effect log-level → workflow-command
  mapping, annotations, notices, collapsible groups, buffered transcripts, and
  the Step namespace (buffer-on-success, spill-on-failure) that gives runs
  their quiet-green / verbose-red voice, plus the decision-log doctrine and
  the emoji vocabulary. Verified against
  @savvy-web/github-action-effects@3.0.4. User-invokable as
  /github-actions:logging.
when_to_use: >
  "pretty action logs", "beautiful logging", "log groups", "::group::",
  "collapsible logs", "Step.withStep", "groupStep", "step summary line",
  "buffer logs", "quiet on success", "debug logs in CI", "ACTIONS_STEP_DEBUG",
  "log annotations", "::error:: file line", "notice annotation", "mask a
  secret in logs", "emoji in action logs", "decision log"
---

# Logging in an action

**There is no ANSI/color API in this ecosystem — do not invent one.** GitHub's
log viewer colors the workflow commands itself; the house look is built
entirely from log levels, groups, buffered steps, glyphs, and alignment. The
contract: a green run reads as one crisp line per step; a red run spills full
evidence exactly where it failed.

Library paths cited below (e.g. `src/runtime/Step.ts`) are inside the
installed `@savvy-web/github-action-effects` package.

## Levels → workflow commands

`ActionsRuntime.Default` installs `ActionsLogger`
(`src/runtime/ActionsLogger.ts`), which maps Effect log levels:

| Call | Emits | Shows up as |
| --- | --- | --- |
| `Effect.logDebug` | `::debug::msg` | Hidden unless the run has step-debug on (`ACTIONS_STEP_DEBUG` secret/variable, or re-run with debug logging) |
| `Effect.log` / `Effect.logInfo` | plain stdout | Normal log line |
| `Effect.logWarning` | `::warning::msg` | Yellow annotation on the run (and PR if file-scoped) |
| `Effect.logError` / `logFatal` | `::error::msg` | Red annotation |

There is no level that maps to `::notice::` — that is `logger.notice` (below).

File-scoped annotations ride on log annotations — only `file`, `line`, `col`
are forwarded (`src/runtime/ActionsLogger.ts`):

```ts
yield* Effect.logError("unused import").pipe(
  Effect.annotateLogs({ file: "src/index.ts", line: "10", col: "1" }),
);
// ::error file=src/index.ts,line=10,col=1::unused import
```

## ActionLogger: notice, group, withBuffer

```ts
const logger = yield* ActionLogger;
```

- `logger.notice(message, properties?)` — the only path to `::notice::`.
  `AnnotationProperties` is the rich shape: `{title, file, startLine, endLine,
  startColumn, endColumn}` (mapped to command properties `line`/`col`/… per
  `@actions/core` semantics — `src/runtime/WorkflowCommand.ts`).
- `logger.group(name, effect)` — brackets the effect in
  `::group::`/`::endgroup::` (acquireUseRelease, so the group always closes).
- `logger.withBuffer(label, effect)` — captures info/debug lines in memory and
  flushes them wrapped in `--- Buffered output for "label" ---` markers **on
  every exit** — success, failure, defect, or interruption
  (`src/layers/ActionLoggerLive.ts`). Buffering is bypassed entirely when the
  minimum log level is Debug-or-lower or `RUNNER_DEBUG=1` (the runner's own
  re-run-with-debug signal), so debug reruns stream live. Warn/error always
  pass through — annotations must not lose their UI affordance.

`Action.run` already wraps your whole program in `withBuffer("action", …)` —
you rarely call it yourself; prefer `Step` below.

## The Step namespace — the house voice

`Step.withStep(name, effect, options?)` is the unit of narration
(`src/runtime/Step.ts`):

- Opens a fresh buffer; info/debug logs inside are captured, not printed.
- **Success** → ONE line: `✅ <name>: <outcome>` (or bare `✅ <name>`), buffer
  discarded.
- **Failure** → `❌ <name>: <error>`, then the buffer spilled indented with
  `│ [DEBUG]` / `│ [INFO]` prefixes, then the cause propagates untouched.
- Warnings/errors pass through live even inside a step.

**The library owns the glyph and the `<name>:` prefix.** Consumers pass ONLY
the outcome:

```ts
yield* Step.withStep("pack dist/npm", Effect.gen(function* () {
  const result = yield* publisher.pack("./dist/npm");
  yield* Effect.logDebug(`packed ${result.tarballPath}`); // buffered
  yield* Step.success(`${result.name}@${result.version} (${result.fileCount} files)`);
  return result;
}));
```

The rest of the surface:

| Member | Use for |
| --- | --- |
| `Step.success(line)` | Set the collapsed one-liner's outcome text (no icon, no name) |
| `Step.failure(line)` | Render the ❌ block **but resolve with the value** — non-fatal per-item failures an aggregating loop records and reports later. `failure` beats `success` if both were called |
| `Step.line(icon, text)` | Immediate, unbuffered informational row indented under the current step (e.g. a provenance URL). Skip the call rather than print an empty row |
| `Step.collapse(steps, reducer)` | N parallel steps → one line when ALL pass (reducer returns the line); any failure or `null` reducer abandons the collapse and each child renders itself |
| `Step.groupStep(name, effect, options?)` | `logger.group` + `withStep` — the outer wrapper for every logical phase |
| `options.defaultSummary(result)` | Summary when the body never called `Step.success` |
| `options.icon` | Success glyph override (e.g. `📦`); failures always render `❌` |

Rendered-output shapes and edge cases: [step-rendering.md](./references/step-rendering.md).

### Structure rules

- **One `Step.groupStep` per logical unit of work; never nest group steps** —
  `::group::` blocks do not nest in the runner UI. Plain `withStep` DOES nest
  (children indent two spaces per depth), so use `groupStep` for phases and
  bare `withStep` for sub-steps.
- Keep outcome lines as pure `format*Line` helpers next to the summary
  builders, unit-tested without any runner:

```ts
// services/summary.ts — pure, no I/O, co-located tests
export const formatCacheLine = (hit: "full" | "partial" | "none", lockfiles: number): string =>
  hit === "none" ? "no cache hit" : `${hit} hit (${lockfiles} lockfile${lockfiles === 1 ? "" : "s"})`;

// call site
yield* Step.success(formatCacheLine("partial", 2));
// ✅ Restore dependency cache: partial hit (2 lockfiles)
```

## The decision-log doctrine

The policy:

> A step that does not run always logs that it did not, and why.
> Decisions (which path a dispatch point took, and on what evidence) are
> logged at info; per-item evidence stays at debug so the info stream reads
> end to end as a decision log.

Concretely:

- **info** = decisions plus the evidence they were taken on; **debug** =
  per-item detail (registry queries, per-file writes).
- A skipped step says so with its reason: `Step: changesets — SKIPPED:
  changesets input is false`. `"changesets: false"`, `"no .changeset/
  directory"` and `"nothing to install"` must never look like silence.
- Open phases with an aligned key/value context block:

```text
Run context
  package manager  pnpm 10.12.4   (packageManager field)
  workspace root   /work (14 packages)
  lockfile         pnpm-lock.yaml
  mode             dry run · changesets on · runtime data offline
```

## Emoji vocabulary

Consistent across actions built on this stack — reuse, don't improvise:

| Glyph | Meaning | | Glyph | Meaning |
| --- | --- | --- | --- | --- |
| ✅ | pass / done | | 🧪 | dry-run |
| ❌ | fail | | 📦 | package / publish |
| ⚠️ | warning | | ♻️ | partial cache hit |
| ⏭️ | skipped | | ⬜ | cache miss |
| 🚀 | release / setup | | 🔏 | provenance / signature |

## Secrets

- Keep secrets `Redacted<string>` end-to-end — they print as `<redacted>` in
  any log or error.
- Any secret **created at runtime** (a minted installation token) must be
  masked before it can appear in logs: `yield* outputs.setSecret(value)`
  (`::add-mask::`). `GitHubToken.provision` does this for you; do the same for
  any token you mint yourself.

## Do this, not this

| Do | Not | Why |
| --- | --- | --- |
| `Step.success("3 packages published")` | `Step.success("✅ Publish: 3 packages published")` | The library owns icon + `<name>:` prefix (`src/runtime/Step.ts`); doubling renders `✅ Publish: ✅ Publish: …` |
| `Step.groupStep` per phase, `withStep` for sub-steps | Nesting `groupStep` inside `groupStep` | `::group::` does not nest in the runner UI |
| `Step.failure("publish-failed")` + return a result | Failing the effect for a per-item error you aggregate | `failure` renders ❌ but lets the loop continue |
| `Effect.logDebug` for per-item evidence | `logInfo` for every registry probe | Info must read as a decision log; debug is free under `ACTIONS_STEP_DEBUG` |
| Log skipped steps with reasons | Silent early `return` | A skipped step must never look like silence |
| `logger.notice(msg, {title})` | Hunting for a log level that emits `::notice::` | No level maps there — dedicated method (`src/services/ActionLogger.ts`) |
| Pure `formatXLine` helpers | Inline template literals per call site | Testable without a runner; consistent voice |
| ANSI escape codes | — | No color API exists; the viewer styles workflow commands |

## Reference map

| Reference | Load when |
| --- | --- |
| [step-rendering.md](./references/step-rendering.md) | You need exact rendered output shapes (indent, spill format, collapse behavior, icons) or the full Step signatures |

## Related skills

`checks-and-reports` owns what lands on GitHub surfaces (checks, summaries,
comments); this skill owns the live run log. `errors-and-state` owns which
failures demote to warnings. `runtime-and-layers` explains what `Action.run`
installs (`ActionsLogger`, the outer buffer). Route from `action-engineering`.
