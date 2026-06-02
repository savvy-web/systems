---
id: packages/silk-effects/api/class/versioningstrategy
title: "VersioningStrategy — silk-effects class"
summary: "Service that classifies the versioning strategy used by a workspace."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# VersioningStrategy

Service that classifies the versioning strategy used by a workspace.

```ts
class VersioningStrategy extends VersioningStrategy_base
```

## Examples

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const strategy = yield* VersioningStrategy;
    return yield* strategy.detect(["@my-org/pkg-a", "@my-org/pkg-b"]);
  }).pipe(
    Effect.provide(VersioningStrategyLive),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  )
);

```
