---
id: packages/silk-effects/api/class/silkworkspaceanalyzer
title: "SilkWorkspaceAnalyzer — silk-effects class"
summary: "Service that performs a full workspace analysis — discovering packages, detecting publishability, computing versioning/tag strategies, and wiring up fixed/link…"
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SilkWorkspaceAnalyzer

Service that performs a full workspace analysis — discovering packages, detecting publishability, computing versioning/tag strategies, and wiring up fixed/linked release groups.

```ts
class SilkWorkspaceAnalyzer extends SilkWorkspaceAnalyzer_base
```

## Examples

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const analyzer = yield* SilkWorkspaceAnalyzer;
    return yield* analyzer.analyze("/path/to/monorepo");
  }).pipe(
    Effect.provide(SilkWorkspaceAnalyzerLive),
    // ... provide all transitive layers
  )
);

```
