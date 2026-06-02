---
id: packages/silk-effects/api/function/buildschemaurl
title: "buildSchemaUrl — silk-effects function"
summary: "Build the expected Biome JSON schema URL for a given version."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# buildSchemaUrl

Build the expected Biome JSON schema URL for a given version.

```ts
function buildSchemaUrl(version: string): string;
```

## Parameters

- `version` `string` — Bare semver string (e.g. `"1.9.3"`).

## Returns

The canonical `biomejs.dev` schema URL for that version.
