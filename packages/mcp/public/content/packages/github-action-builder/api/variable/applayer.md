---
id: packages/github-action-builder/api/variable/applayer
title: "AppLayer — github-action-builder variable"
summary: "Combined layer providing all services."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# AppLayer

Combined layer providing all services.

```ts
AppLayer: Layer.Layer<ConfigService | ValidationService | BuildService | PersistLocalService, never, never>
```

## Examples

```typescript
import { Effect } from "effect";
import { AppLayer, BuildService, ConfigService } from "@savvy-web/github-action-builder";

const program = Effect.gen(function* () {
  const configService = yield* ConfigService;
  const buildService = yield* BuildService;

  const { config } = yield* configService.load();
  const result = yield* buildService.build(config);

  return result;
});

Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

```
