---
id: packages/github-action-builder/api/interface/buildservice
title: "BuildService — github-action-builder interface"
summary: "BuildService interface for build and bundling capabilities."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BuildService

[BuildService](silk://packages/github-action-builder/api/variable/buildservice) interface for build and bundling capabilities.

```ts
interface BuildService
```

## Members

### build

```ts
readonly build: (config: Config, options?: BuildRunnerOptions) => Effect.Effect<BuildResult, BuildError |
  MainEntryMissing | WorkerEntryMissing | WorkerEntryInvalidName>;
```

Build all entries from the configuration.

### bundle

```ts
readonly bundle: (entry: DetectedEntry, config: Config) => Effect.Effect<BundleResult, BuildError>;
```

Bundle a single entry point.

### clean

```ts
readonly clean: (outputDir: string) => Effect.Effect<void, BuildError>;
```

Clean the output directory.

### formatBytes

```ts
readonly formatBytes: (bytes: number) => string;
```

Format bytes as human-readable string.

### formatResult

```ts
readonly formatResult: (result: BuildResult) => string;
```

Format build result for display.

## Examples

```typescript
import { Effect } from "effect";
import { AppLayer, BuildService, ConfigService } from "@savvy-web/github-action-builder";

const program = Effect.gen(function* () {
  const configService = yield* ConfigService;
  const buildService = yield* BuildService;

  const { config } = yield* configService.load();
  const result = yield* buildService.build(config);

  if (result.success) {
    console.log("Build complete:", result.entries.length, "entries");
  }
});

Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

```
