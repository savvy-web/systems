---
id: packages/tsdown-plugins/api/class/configvalidationerror
title: "ConfigValidationError — tsdown-plugins class"
summary: "A savvy.build.ts or publishConfig.targets config is structurally invalid; raised before any build work."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ConfigValidationError

A savvy.build.ts or publishConfig.targets config is structurally invalid; raised before any build work.

```ts
class ConfigValidationError extends ConfigValidationError_base<{
  readonly path: string;
  readonly reason: string;
}>
```

## Members

### message

```ts
get message(): string;
```

### path

```ts
readonly path: string;
```

### reason

```ts
readonly reason: string;
```
