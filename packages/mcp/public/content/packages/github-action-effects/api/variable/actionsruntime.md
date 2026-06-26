---
id: packages/github-action-effects/api/variable/actionsruntime
title: "ActionsRuntime — github-action-effects variable"
summary: "A single convenience layer that wires all core services together for a GitHub Actions environment. Provides: - `ConfigProvider` backed by GitHub Actions `INPUT…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionsRuntime

A single convenience layer that wires all core services together for a GitHub Actions environment. Provides: - `ConfigProvider` backed by GitHub Actions `INPUT_*` environment variables - `Logger` that emits GitHub Actions workflow commands (`::debug::`, `::warning::`, etc.) - `ActionOutputs` for setting outputs and writing step summaries - `ActionState` for reading and writing action state across phases - `ActionLogger` for group markers and buffered logging - `ActionEnvironment` for reading GitHub/runner context variables - `FileSystem` (Node.js) required by `ActionOutputs` and `ActionState` - `HttpClient` (fetch-backed) required by `OidcTokenIssuerLive`, `GitHubAppLive`, and `ActionCacheLive`

```ts
ActionsRuntime: {
  readonly Default: Layer.Layer<ActionLogger | ActionOutputs |
  ActionEnvironment | ActionState | import("@effect/platform/HttpClient").HttpClient | import("@effect/platform/FileSystem").FileSystem, never, never>;
}
```

## Examples

```ts
import { Effect, Config } from "effect"
import { ActionsRuntime } from "@savvy-web/github-action-effects"

const program = Effect.gen(function* () {
  const name = yield* Config.string("name")
  yield* Effect.log(`Hello, ${name}!`)
})

Effect.runPromise(Effect.provide(program, ActionsRuntime.Default))

```
