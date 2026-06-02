---
id: packages/github-action-builder/api/interface/validationservice
title: "ValidationService — github-action-builder interface"
summary: "ValidationService interface for validation capabilities."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ValidationService

[ValidationService](silk://packages/github-action-builder/api/variable/validationservice) interface for validation capabilities.

```ts
interface ValidationService
```

## Members

### formatResult

```ts
readonly formatResult: (result: ValidationResult) => string;
```

Format validation result for display.

### isCI

```ts
readonly isCI: () => Effect.Effect<boolean>;
```

Check if running in CI environment.

### isStrict

```ts
readonly isStrict: (configStrict?: boolean) => Effect.Effect<boolean>;
```

Check if strict mode is enabled.

### validate

```ts
readonly validate: (config: Config, options?: ValidateOptions) => Effect.Effect<ValidationResult, ValidationError>;
```

Validate configuration and project structure.

### validateActionYml

```ts
readonly validateActionYml: (path: string) => Effect.Effect<ActionYmlResult, ValidationError>;
```

Validate action.yml file.

## Examples

```typescript
import { Effect } from "effect";
import { AppLayer, ConfigService, ValidationService } from "@savvy-web/github-action-builder";

const program = Effect.gen(function* () {
  const configService = yield* ConfigService;
  const validationService = yield* ValidationService;

  const { config } = yield* configService.load();
  const result = yield* validationService.validate(config);

  if (!result.valid) {
    console.error("Validation failed:", result.errors);
  }
});

Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

```
