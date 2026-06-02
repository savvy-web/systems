---
id: packages/github-action-effects/api/function/generatepackageviewurl
title: "generatePackageViewUrl — github-action-effects function"
summary: "Generate a URL to view the published package on its registry"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# generatePackageViewUrl

Generate a URL to view the published package on its registry

```ts
function generatePackageViewUrl(registry: string | null | undefined, packageName: string | null | undefined): string | undefined;
```

## Parameters

- `registry` `string | null | undefined` — Registry URL
- `packageName` `string | null | undefined` — Name of the package (including scope if any)

## Returns

URL to view the package, or undefined if not supported
