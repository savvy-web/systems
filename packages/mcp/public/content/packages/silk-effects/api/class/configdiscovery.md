---
id: packages/silk-effects/api/class/configdiscovery
title: "ConfigDiscovery — silk-effects class"
summary: "Service that locates named config files within a workspace using priority-ordered search paths."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ConfigDiscovery

Service that locates named config files within a workspace using priority-ordered search paths.

```ts
class ConfigDiscovery extends ConfigDiscovery_base
```

## Examples

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const discovery = yield* ConfigDiscovery;
    return yield* discovery.find("biome.json");
  }).pipe(
    Effect.provide(ConfigDiscoveryLive),
    Effect.provide(NodeContext.layer),
  )
);

```
