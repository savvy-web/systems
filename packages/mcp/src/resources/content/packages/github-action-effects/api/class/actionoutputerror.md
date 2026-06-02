---
id: packages/github-action-effects/api/class/actionoutputerror
title: "ActionOutputError — github-action-effects class"
summary: "Error when a GitHub Action output fails schema validation or writing."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionOutputError

Error when a GitHub [Action](silk://packages/github-action-effects/api/variable/action) output fails schema validation or writing.

```ts
class ActionOutputError extends ActionOutputError_base<{
    readonly outputName: string;
    readonly reason: string;
}>
```

## Members

### outputName

```ts
readonly outputName: string;
```

The output name.

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.
