---
id: packages/github-action-builder/api/interface/configservice
title: "ConfigService — github-action-builder interface"
summary: "ConfigService interface for configuration management capabilities."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigService

[ConfigService](silk://packages/github-action-builder/api/variable/configservice) interface for configuration management capabilities.

```ts
interface ConfigService
```

## Members

### detectEntries

```ts
readonly detectEntries: (cwd: string, entries?: {
        main?: string;
        pre?: string;
        post?: string;
    }) => Effect.Effect<DetectEntriesResult, MainEntryMissing>;
```

Detect entry points in the project.

### load

```ts
readonly load: (options?: LoadConfigOptions) => Effect.Effect<LoadConfigResult, ConfigError>;
```

Load configuration from file or use defaults.

### resolve

```ts
readonly resolve: (input?: Partial<ConfigInput>) => Effect.Effect<Config, ConfigError>;
```

Resolve partial configuration input to full configuration.

## Examples

```typescript
import { Effect } from "effect";
import { AppLayer, ConfigService } from "@savvy-web/github-action-builder";

const program = Effect.gen(function* () {
  const configService = yield* ConfigService;
  const result = yield* configService.load({ cwd: process.cwd() });
  console.log("Loaded config:", result.config);
});

Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

```
