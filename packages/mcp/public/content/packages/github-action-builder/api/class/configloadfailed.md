---
id: packages/github-action-builder/api/class/configloadfailed
title: "ConfigLoadFailed — github-action-builder class"
summary: "Error when configuration file fails to load (import error, syntax error, etc.)."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigLoadFailed

Error when configuration file fails to load (import error, syntax error, etc.).

```ts
class ConfigLoadFailed extends ConfigLoadFailedBase<{
  readonly path: string;
  readonly cause: unknown;
}>
```

## Members

### cause

```ts
readonly cause: unknown;
```

The underlying error or error message.

### path

```ts
readonly path: string;
```

The path to the config file that failed to load.
