---
id: packages/github-action-effects/api/variable/actionenvironmenttest
title: "ActionEnvironmentTest — github-action-effects variable"
summary: "Test implementation for ActionEnvironment."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionEnvironmentTest

Test implementation for [ActionEnvironment](silk://packages/github-action-effects/api/class/actionenvironment).

```ts
ActionEnvironmentTest: {
    readonly layer: (env: Record<string, string>, payload?: WebhookPayload) => Layer.Layer<ActionEnvironment>;
    readonly empty: () => Layer.Layer<ActionEnvironment>;
}
```
