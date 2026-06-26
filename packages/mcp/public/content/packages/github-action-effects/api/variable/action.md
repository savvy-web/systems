---
id: packages/github-action-effects/api/variable/action
title: "Action — github-action-effects variable"
summary: "Namespace for top-level GitHub Action helpers."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# Action

Namespace for top-level GitHub [Action](silk://packages/github-action-effects/api/variable/action) helpers.

```ts
Action: {
  readonly run: {
    <E>(program: Effect.Effect<void, E, CoreServices>): Promise<void>;
    <E>(program: Effect.Effect<void, E, CoreServices>, options: ActionRunOptions): Promise<void>;
    <E, R>(program: Effect.Effect<void, E, CoreServices | R>, options: ActionRunOptions<R>): Promise<void>;
  }; /** Resolve a LogLevelInput to a concrete ActionLogLevel. */
  readonly resolveLogLevel: (input: LogLevelInput) => ActionLogLevel;
  readonly formatCause: (cause: Cause.Cause<unknown>) => string;
}
```

## Examples

```ts
import { Effect } from "effect"
import { Action, ActionLogger } from "@savvy-web/github-action-effects"

const program = Effect.gen(function* () {
  const logger = yield* ActionLogger
  // ... your action logic
})

Action.run(program)

```
