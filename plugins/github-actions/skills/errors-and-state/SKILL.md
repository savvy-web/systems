---
name: errors-and-state
description: >
  Error handling and cross-phase state for actions on
  @savvy-web/github-action-effects — the Schema.TaggedErrorClass house style
  with computed message getters and derived predicates, the demote-vs-die
  decision, post-action belt-and-braces, per-item accumulation, and
  Schema.Class state bundles with STATE_KEYS round-tripped through ActionState.
  Verified against @savvy-web/github-action-effects@3.0.4. User-invokable as
  /github-actions:errors-and-state.
when_to_use: >
  "define an action error", "TaggedErrorClass", "should this failure fail the
  action", "catchTag vs catchAll in an action", "setFailed", "post-action must
  not fail", "catchDefect", "collect failures without aborting",
  "ErrorAccumulator", "pass data from pre to post", "ActionState save/get",
  "STATE_KEYS", "state vs outputs"
---

# Errors and state

Two disciplines that keep an action's failure behavior legible: every error is
a typed, schema-annotated class whose message renders itself, and every value
crossing a phase boundary (pre → main → post) is a `Schema.Class` bundle
round-tripped through `ActionState`. Top-level failure belongs to `Action.run`
— you never write an exit handler.

## Error classes: `Schema.TaggedErrorClass` + message getter

House shape: one `errors/errors.ts` module, every error a
`Schema.TaggedErrorClass` with `.annotate({description})` on each field, a
computed `get message()`, and derived predicates where retry logic wants them:

```typescript
export class GitError extends Schema.TaggedErrorClass<GitError>()("GitError", {
 operation: GitOperation.annotate({ description: "The git operation that failed" }),
 exitCode: Schema.Number.check(Schema.isInt()).annotate({ description: "Exit code from the git command" }),
 stderr: Schema.String.annotate({ description: "Standard error output from git" }),
}) {
 get message() {
  return `Git ${this.operation} failed (exit ${this.exitCode}): ${this.stderr}`;
 }

 get isRetryable(): boolean {
  return this.operation === "fetch" || this.operation === "push";
 }
}
```

Rules:

- Fields are structured evidence (`operation`, `exitCode`, `stderr`), never a
  single pre-baked `message: string` — the getter composes the message.
  (Exception: when wrapping an upstream message verbatim, a `message` field is
  fine — but keep the structured fields beside it.)
- Derived predicates (`isRetryable`, `isRateLimited`, `isServerError`,
  `partialSuccess`) live on the class, and a union-level helper
  (`isRetryableError(error: ActionError)`) switches on `_tag` to expose them
  uniformly.
- Export a `type ActionError = A | B | …` union for the program's error channel.
- The *library's* own 41 errors are `Data.TaggedError` with public fields
  (`GitHubClientError{operation, status?, reason, retryable, retryAfterMs?}`,
  …) — match on their `_tag`s with `Effect.catchTag`; do not wrap them unless
  you are adding action-domain meaning.
- An aggregate error for partial failure carries both halves — a `failures`
  field and a `successful` field — so the reporter can show what worked.

## Who owns failure: the `Action.run` contract

`Action.run` catches every cause, formats `[Tag] message` via
`Action.formatCause` (it uses `||`, not `??`, so an empty `Data.TaggedError`
default `message` falls through to `reason`), emits one `::error::` annotation
(newlines `%0A`-encoded), prints the span trace at `::debug::`, and sets
`process.exitCode = 1`. Therefore:

| Do this | Not this |
| --- | --- |
| Let uncaught typed errors propagate to `Action.run` | Top-level `Effect.catch` → `outputs.setFailed("…")` — loses the `[Tag]` prefix, stack, and span trace; do this only when a friendlier one-line headline genuinely outweighs those diagnostics |
| `outputs.setFailed(msg)` only for an *explicit* business-rule failure where the effect itself should keep succeeding | `process.exit(1)` anywhere |
| `Layer.orDie` on misconfiguration (missing token, unreadable state) at the layer boundary | Threading a "config missing" checked error through every program signature |

## Demote vs die

Decide per failure, at the call site:

- **Degrade and continue** — the step is optional or has a safe fallback:
  `Effect.catchTag` the *specific* error, `Effect.logWarning` with the reason,
  return a degraded value. A cache restore is the canonical case: catch
  `CacheError` → warn → return `"none"` (a miss), then add a generic
  `Effect.catch` beneath it so an adjacent error (e.g. `ActionStateError` from
  a nested `state.save`) also degrades to a miss instead of failing the
  action.
- **Fail the action** — the step is the point of the run: let the typed error
  propagate. If the failure should be visible as a red check in the GitHub UI,
  make sure the work runs *inside* the `withCheckRun` bracket
  ([checks-and-reports](../checks-and-reports/SKILL.md)).
- **Die** — impossible-by-construction states and boot misconfiguration:
  `Layer.orDie`, `Effect.orDie`. Never `catchTag` a defect back into the error
  channel.

Non-fatal writes stay non-fatal explicitly: job summaries and sticky comments
are always piped through `Effect.catch(… logWarning …)` — a reporting failure
must never fail a run that did the real work.

## Post-action belt-and-braces

`post.ts` never fails the workflow. Both channels are caught, both log
warnings:

```typescript
}).pipe(
 // Post-action never fails the workflow — log typed errors as warnings.
 Effect.catch((error) =>
  Effect.logWarning(`Post-action error: ${error instanceof Error ? error.message : String(error)}`),
 ),
 // Defense-in-depth: also swallow programming defects.
 Effect.catchDefect((defect) =>
  Effect.logWarning(`Post-action defect: ${defect instanceof Error ? defect.message : String(defect)}`),
 ),
);
```

Token revocation in post additionally wraps its own `Effect.catch` around
`GitHubToken.dispose()` so a revoke failure still lets duration logging run.

## Accumulate, don't abort

For batch work where one item's failure must not stop the rest:

- `ErrorAccumulator.forEachAccumulate(items, fn)` /
  `forEachAccumulateConcurrent(items, fn, n)` (library util) — error channel
  `never`, returns `{ successes, failures: [{ item, error }] }`. Feed
  `failures` into the findings/report model, and decide *afterwards* whether
  the aggregate constitutes failure (fail via an aggregate error or
  `setFailed`).
- `Effect.result(step)` per item when you need the full `Result` (e.g. marking
  leftover check runs cancelled without failing cleanup).

## Cross-phase state

GitHub Actions persists state between phases as `STATE_*` env vars. Never raw
strings: one `state.ts` module with `Schema.Class` bundles and a `STATE_KEYS`
const:

```typescript
export class CacheState extends Schema.Class<CacheState>("CacheState")({
 key: Schema.String,
 paths: Schema.Array(Schema.String),
 restored: Schema.Boolean,
}) {}

export class StartTimeState extends Schema.Class<StartTimeState>("StartTimeState")({
 startedAt: Schema.Number,
}) {}

export const STATE_KEYS = {
 cacheState: "cache-state",
 startTime: "start-time",
} as const;
```

API: `ActionState.save(key, value, schema)` / `get(key, schema)` /
`getOptional(key, schema) → Effect<Option<A>>` — all Schema round-trips,
failing `ActionStateError{key, reason, rawValue?}` on decode drift.

Rules:

- **Reader uses `getOptional` and treats `None` as "main didn't get there"** —
  post runs even when main failed early, so absent state is normal, not an
  error: unconditional teardown (kill a spawned worker) runs first, then the
  presence of cache state gates the cache save.
- **State is for phase plumbing; outputs are the public contract.** A value a
  downstream workflow step reads goes to `ActionOutputs`
  ([outputs-and-schemas](../outputs-and-schemas/SKILL.md)); a value your own
  post phase needs (server pid, cache key, start time) goes to state. Never
  both by reflex.
- Teardown ordering in post: unconditional cleanup (kill spawned workers)
  before conditional work (cache save), each step demoted per the rules above.
- The App-token envelope is state too, under `GitHubToken`'s own internal key —
  never touch it directly; use `GitHubToken.provision/client/dispose`
  ([github-app-auth](../github-app-auth/SKILL.md)).

## Related skills

`runtime-and-layers` owns where `Layer.orDie` sits and the entry shapes;
`checks-and-reports` turns accumulated failures into findings, conclusions,
and reports; `github-app-auth` owns the token state lifecycle;
`testing-actions` covers asserting on error channels and pre-populating
`ActionStateTest` to simulate a prior phase; `logging` owns the
warning/decision-log voice these catches write in.
