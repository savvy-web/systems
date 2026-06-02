---
id: packages/github-action-effects/api/class/actioninputerror
title: "ActionInputError — github-action-effects class"
summary: "Error when a GitHub Action input is missing or fails schema validation."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionInputError

Error when a GitHub [Action](silk://packages/github-action-effects/api/variable/action) input is missing or fails schema validation.

```ts
class ActionInputError extends ActionInputError_base<{
    readonly inputName: string;
    readonly reason: string;
    readonly rawValue: string | undefined;
}>
```

## Members

### inputName

```ts
readonly inputName: string;
```

The input name from action.yml.

### rawValue

```ts
readonly rawValue: string | undefined;
```

The raw string value received, if any.

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.
