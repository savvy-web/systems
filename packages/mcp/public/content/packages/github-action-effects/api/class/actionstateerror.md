---
id: packages/github-action-effects/api/class/actionstateerror
title: "ActionStateError — github-action-effects class"
summary: "Error when GitHub Action state reading/writing fails."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionStateError

Error when GitHub [Action](silk://packages/github-action-effects/api/variable/action) state reading/writing fails.

```ts
class ActionStateError extends ActionStateError_base<{
  readonly key: string; /** Human-readable description of what went wrong. */
  readonly reason: string; /** The raw string value received, if any. */
  readonly rawValue: string | undefined;
}>
```

## Members

### key

```ts
readonly key: string;
```

The state key name.

### rawValue

```ts
readonly rawValue: string | undefined;
```

### reason

```ts
readonly reason: string;
```
