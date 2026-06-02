---
id: packages/silk-effects/api/class/biomeschemasync
title: "BiomeSchemaSync — silk-effects class"
summary: "Service that keeps the `$schema` URL in Biome config files in sync with a target version."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# BiomeSchemaSync

Service that keeps the `$schema` URL in Biome config files in sync with a target version.

```ts
class BiomeSchemaSync extends BiomeSchemaSync_base
```

## Examples

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const syncer = yield* BiomeSchemaSync;
    return yield* syncer.sync("^1.9.3");
  }).pipe(
    Effect.provide(BiomeSchemaSyncLive),
    Effect.provide(NodeContext.layer),
  )
);

```
