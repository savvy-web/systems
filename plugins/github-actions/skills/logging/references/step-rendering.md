# Step — full API and rendered output

> Distilled from `@savvy-web/github-action-effects@3.0.4` source
> (`src/runtime/Step.ts`, `src/runtime/StepRuntime.ts`) and production actions
> built on this stack, 2026-07-23. On version skew the installed source wins —
> re-verify before relying on this.

## Signatures

```ts
Step.withStep:  <A, E, R>(name: string, effect: Effect<A, E, R>, options?: WithStepOptions<A>) => Effect<A, E, R>
Step.success:   (line: string) => Effect<void>          // no-op outside a step (debug log)
Step.failure:   (line: string) => Effect<void>          // no-op outside a step; beats success
Step.line:      (icon: string, text: string) => Effect<void>
Step.collapse:  <A>(steps: ReadonlyArray<{name: string; effect: Effect<A, unknown>}>,
                    reducer: (results: ReadonlyArray<{name: string; result: A}>) => string | null)
                  => Effect<ReadonlyArray<A>, unknown>
Step.groupStep: <A, E, R>(name, effect, options?) => Effect<A, E, R | ActionLogger>

interface WithStepOptions<A> {
  defaultSummary?: (result: A) => string; // used when the body never called Step.success
  icon?: string;                          // success glyph override; failure is always ❌
}
```

## Buffering mechanics

`withStep` installs its own buffering logger as the **sole** logger for the
step's scope (overriding `Logger.CurrentLoggers`, so `ActionsLogger` cannot
double-print) and pushes a frame onto a `Context.Reference` step stack.
Info/debug lines are pushed to the frame's buffer; warn/error always pass
through as workflow commands (`src/runtime/StepRuntime.ts`). Child fibers
inherit the context, so concurrent sibling steps never share buffers.

Indentation is two spaces per stack depth (`indent(depth)`); the outermost
step is depth 0. **`withStep` nests** (children indent); `groupStep` must not
nest because `::group::` doesn't.

## Rendered shapes

Success with outcome (`Step.success` or `defaultSummary` returned a string):

```text
✅ pack dist/npm: my-pkg@1.2.3 (42 files)
```

Bare success (no summary set):

```text
✅ resolve versions
```

Custom icon (`options.icon: "📦"`):

```text
📦 pack dist/npm: my-pkg@1.2.3 (42 files)
```

Failure — header, buffer spill with `│ [LEVEL]` rows, closing `└ Error:` line
(the trailer is suppressed when the buffer is empty):

```text
❌ pack dist/npm: ENOENT: no such file or directory
   │ [DEBUG] resolving ./dist/npm
   │ [INFO] using npm pack --json
   └ Error: ENOENT: no such file or directory
```

Nested step (depth 1 under an outer step/group):

```text
  ✅ probe npm: 1.2.2 published
```

`Step.line("🔏", "provenance  https://…")` — immediate, unbuffered, rendered
at child depth with no name/`:`:

```text
  🔏 provenance  https://…
```

## Error message resolution (failure header)

`renderErrorMessage` (`src/runtime/Step.ts`): first failure in the cause →
`Error#message` / plain string / object's string `message` / `String(value)`;
defects fall back to `Cause.pretty`. Callers' error text should describe the
outcome only — the library prepends `❌ <name>:`.

## `Step.failure` semantics

Marks the frame failed without failing the effect: the envelope renders the ❌
block **and returns the body's value**, letting an aggregating loop continue
(one registry rejecting a publish while siblings succeed). If the effect
*also* fails, normal failure rendering wins. When both `failure` and `success`
were called, `failure` wins.

## `Step.collapse` decision table

Runs all children in parallel (unbounded — meant for small N of registry
probes / attestations), each with its own frame and buffer, **emitting
nothing** until all settle:

| Outcome | Rendering |
| --- | --- |
| All succeed, reducer returns a string | ONE info line at the parent depth, e.g. `probed 2 registries` — per-child lines suppressed |
| All succeed, reducer returns `null` | Collapse abandoned: each child emits its own success line in input order |
| Any child failed OR called `Step.failure` | Collapse abandoned: each child renders its own line/block in input order; the FIRST failure's cause then propagates |

A child that called `Step.failure` resolved with a value, but it still counts
as failed for collapse purposes — its ❌ block must not be collapsed away.

## `Step.groupStep`

`logger.group(name, withStep(name, effect, options))` — a collapsible runner
group whose last line is the step summary. The natural phase wrapper:

```text
▸ Restore dependency cache        ← collapsed group, click to expand
    …buffered lines only shown inside…
  ✅ Restore dependency cache: partial hit (2 lockfiles)
```

House usage: every phase is a `groupStep`; sub-work inside uses bare
`withStep`/`Step.success`; outcome text comes from pure `format*Line` helpers.
