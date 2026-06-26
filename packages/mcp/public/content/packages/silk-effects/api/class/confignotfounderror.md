---
id: packages/silk-effects/api/class/confignotfounderror
title: "ConfigNotFoundError — silk-effects class"
summary: "Raised when a config file cannot be located in any of the expected locations."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ConfigNotFoundError

Raised when a config file cannot be located in any of the expected locations.

```ts
class ConfigNotFoundError extends ConfigNotFoundError_base<{
  readonly name: string;
  readonly searchedPaths: ReadonlyArray<string>;
}>
```

## Members

### message

```ts
get message(): string;
```

### name

```ts
readonly name: string;
```

### searchedPaths

```ts
readonly searchedPaths: ReadonlyArray<string>;
```
