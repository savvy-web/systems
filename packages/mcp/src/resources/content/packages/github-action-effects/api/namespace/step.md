---
id: packages/github-action-effects/api/namespace/step
title: "Step — github-action-effects namespace"
summary: "namespace Step from @savvy-web/github-action-effects."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# Step

## Members

### collapse

```ts
collapse: <A>(steps: ReadonlyArray<CollapseStep<A>>, reducer: (results: ReadonlyArray<CollapseResult<A>>) => string | null) => Effect.Effect<ReadonlyArray<A>, unknown>
```

Run N steps in parallel. On all-success, the reducer is called with `{ name, result }` pairs in input order; if it returns a string, that single info line is emitted **instead of** N per-step lines. If the reducer returns `null`, the collapse is abandoned and each child step emits its own line as if it had been wrapped in `withStep` directly. On any child failure, the collapse is also abandoned — each child emits its own success line or failure block. The first child failure's cause is then propagated. Concurrency is unbounded — the spec is for parallel registry probes / attestations where the N is small (typically 2-4).

### CollapseResult

```ts
interface CollapseResult<A>
```

The shape passed to the collapse reducer.

### CollapseStep

```ts
interface CollapseStep<A>
```

One entry in the collapse input list.

### failure

```ts
failure: (line: string) => Effect.Effect<void>
```

Mark the current step as failed without throwing. The step's withStep envelope renders `❌ <name>: <line>` (with the usual buffer spill) instead of the success line, but the wrapped effect still resolves with its value so the surrounding loop can continue and aggregate the outcome. Use this for non-fatal target failures the orchestrator records as results and reports later — e.g. one registry rejecting a publish while siblings succeed. For failures that should abort the fiber, fail the effect instead; withStep renders the same `❌` block and propagates the cause. Calling outside a withStep envelope is a no-op (with a defensive debug log). When both `failure` and success are called on the same step, `failure` wins.

### groupStep

```ts
groupStep: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>, options?: WithStepOptions<A>) => Effect.Effect<A, E, R | ActionLogger>
```

Wrap an Effect in both ../services/[ActionLogger](silk://packages/github-action-effects/api/class/actionlogger).js AND withStep. The natural choice for a phase's outer scope (Phase 1, Phase 2, Phase 3): a collapsible GitHub Actions block containing a step-summary at the end.

### success

```ts
success: (line: string) => Effect.Effect<void>
```

Set the success summary line for the current step. Calling outside a withStep envelope is a no-op (with a defensive debug log).

### withStep

```ts
withStep: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>, options?: WithStepOptions<A>) => Effect.Effect<A, E, R>
```

Wrap an Effect in the step lifecycle. On success, emits exactly one info-level summary line: `"<indent>✅ <name>: <line>"` when the body called success (or `options.defaultSummary` returned a string), or the bare `"<indent>✅ <name>"` when neither is set. The debug buffer is discarded. On failure, emits `"<indent>❌ <name>: <error message>"`, spills the debug buffer indented under the failure header, then propagates the original error untouched. The buffered lines retain their chronological order. If the body called failure (rather than failing the effect), the step renders the same `❌` block — header plus buffer spill — but returns its value instead of propagating a cause. See failure. The library is the single source of truth for the `✅` / `❌` icon and the `<name>:` prefix. Consumers pass ONLY the outcome to success. Nested `withStep` calls track depth automatically via the fiber-local step stack. The outermost step is depth 0; each child indents by two spaces.

### WithStepOptions

```ts
interface WithStepOptions<A>
```

Options for withStep.
