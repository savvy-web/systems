---
id: packages/silk-effects/api/class/tagstrategy
title: "TagStrategy — silk-effects class"
summary: "Service that determines and applies the git-tag naming strategy for a release."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# TagStrategy

Service that determines and applies the git-tag naming strategy for a release.

```ts
class TagStrategy extends TagStrategy_base
```

## Examples

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const tags = yield* TagStrategy;
    const strategyType = yield* tags.determine({ type: "independent", fixedGroups: [], publishablePackages: [] });
    return yield* tags.formatTag("@my-org/pkg", "1.2.3", strategyType);
  }).pipe(Effect.provide(TagStrategyLive))
);
// => "@my-org/pkg@1.2.3"

```
