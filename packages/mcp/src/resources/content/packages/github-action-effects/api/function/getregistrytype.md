---
id: packages/github-action-effects/api/function/getregistrytype
title: "getRegistryType — github-action-effects function"
summary: "Detect the type of a registry from its URL"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# getRegistryType

Detect the type of a registry from its URL

```ts
function getRegistryType(registry: string | null | undefined): RegistryType;
```

## Parameters

- `registry` `string | null | undefined` — Registry URL, or null/undefined when no registry is configured.

## Returns

The registry type. Returns `"npm"` when `registry` is null or undefined: an absent registry resolves to the public npm registry (`registry.npmjs.org`), which is this library's publishing default.
