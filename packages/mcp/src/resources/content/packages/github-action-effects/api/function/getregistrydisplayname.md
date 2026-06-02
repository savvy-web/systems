---
id: packages/github-action-effects/api/function/getregistrydisplayname
title: "getRegistryDisplayName — github-action-effects function"
summary: "Get a human-readable display name for a registry URL."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# getRegistryDisplayName

Get a human-readable display name for a registry URL.

```ts
function getRegistryDisplayName(registry: string | null | undefined): string;
```

## Parameters

- `registry` `string | null | undefined` — Registry URL, or null/undefined when no registry is configured.

## Returns

Human-readable registry name (e.g. "npm", "GitHub Packages", or the hostname for custom registries). Returns `"npm"` when `registry` is null or undefined, matching [getRegistryType](silk://packages/github-action-effects/api/function/getregistrytype): an absent registry resolves to the public npm registry (`registry.npmjs.org`), this library's default.
