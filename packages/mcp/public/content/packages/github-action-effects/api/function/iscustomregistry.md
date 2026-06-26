---
id: packages/github-action-effects/api/function/iscustomregistry
title: "isCustomRegistry — github-action-effects function"
summary: "Check if a registry URL is a custom (non-standard) registry"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# isCustomRegistry

Check if a registry URL is a custom (non-standard) registry

```ts
function isCustomRegistry(registry: string | null | undefined): boolean;
```

## Parameters

- `registry` `string | null | undefined` — Registry URL to check

## Returns

true if this is not npm, GitHub Packages, or JSR
