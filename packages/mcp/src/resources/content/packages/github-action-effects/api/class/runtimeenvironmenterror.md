---
id: packages/github-action-effects/api/class/runtimeenvironmenterror
title: "RuntimeEnvironmentError — github-action-effects class"
summary: "Error when a required runtime environment variable (e.g. GITHUB_OUTPUT) is missing."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# RuntimeEnvironmentError

Error when a required runtime environment variable (e.g. GITHUB_OUTPUT) is missing.

```ts
class RuntimeEnvironmentError extends RuntimeEnvironmentError_base<{
    readonly variable: string;
    readonly message: string;
}>
```

## Members

### message

```ts
readonly message: string;
```

Human-readable description of what went wrong.

### variable

```ts
readonly variable: string;
```

The environment variable name.
