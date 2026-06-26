---
id: packages/github-action-effects/api/class/actionenvironmenterror
title: "ActionEnvironmentError — github-action-effects class"
summary: "Error when a required environment variable is missing or invalid."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionEnvironmentError

Error when a required environment variable is missing or invalid.

```ts
class ActionEnvironmentError extends ActionEnvironmentError_base<{
  readonly variable: string; /** Human-readable description of what went wrong. */
  readonly reason: string;
}>
```

## Members

### reason

```ts
readonly reason: string;
```

### variable

```ts
readonly variable: string;
```

The environment variable name.
