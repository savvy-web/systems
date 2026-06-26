---
id: packages/github-action-effects/api/interface/actionrunoptions
title: "ActionRunOptions — github-action-effects interface"
summary: "Options for `Action.run`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionRunOptions

Options for `Action.run`.

```ts
interface ActionRunOptions<R = never>
```

## Members

### layer

```ts
readonly layer?: Layer.Layer<R, never, never>;
```

Additional layer to merge with the core services.
