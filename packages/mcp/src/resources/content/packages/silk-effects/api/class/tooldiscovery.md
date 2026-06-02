---
id: packages/silk-effects/api/class/tooldiscovery
title: "ToolDiscovery — silk-effects class"
summary: "Service that resolves CLI tools — locating them globally (PATH) or locally (via package manager), extracting versions, enforcing source and version constraints…"
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ToolDiscovery

Service that resolves CLI tools — locating them globally (PATH) or locally (via package manager), extracting versions, enforcing source and version constraints, and caching results.

```ts
class ToolDiscovery extends ToolDiscovery_base
```

## Examples

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const td = yield* ToolDiscovery;
    return yield* td.resolve(
      ToolDefinition.make({ name: "biome" })
    );
  }).pipe(
    Effect.provide(ToolDiscoveryLive),
    Effect.provide(NodeContext.layer),
  )
);

```
