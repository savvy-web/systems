---
id: packages/github-action-effects/api/function/isjsrregistry
title: "isJsrRegistry — github-action-effects function"
summary: "Check if a registry URL is JSR"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# isJsrRegistry

Check if a registry URL is JSR

```ts
function isJsrRegistry(registry: string | null | undefined): boolean;
```

## Parameters

- `registry` `string | null | undefined` — Registry URL to check

## Returns

true if this is JSR (jsr.io or subdomain)
