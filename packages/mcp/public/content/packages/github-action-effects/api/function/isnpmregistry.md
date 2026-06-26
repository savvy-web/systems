---
id: packages/github-action-effects/api/function/isnpmregistry
title: "isNpmRegistry — github-action-effects function"
summary: "Check if a registry URL is the npm public registry"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# isNpmRegistry

Check if a registry URL is the npm public registry

```ts
function isNpmRegistry(registry: string | null | undefined): boolean;
```

## Parameters

- `registry` `string | null | undefined` — Registry URL to check

## Returns

true if this is the npm public registry (registry.npmjs.org or subdomain)
