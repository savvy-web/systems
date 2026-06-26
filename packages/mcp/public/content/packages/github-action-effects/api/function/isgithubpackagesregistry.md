---
id: packages/github-action-effects/api/function/isgithubpackagesregistry
title: "isGitHubPackagesRegistry — github-action-effects function"
summary: "Check if a registry URL is GitHub Packages"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# isGitHubPackagesRegistry

Check if a registry URL is GitHub Packages

```ts
function isGitHubPackagesRegistry(registry: string | null | undefined): boolean;
```

## Parameters

- `registry` `string | null | undefined` — Registry URL to check

## Returns

true if this is GitHub Packages (npm.pkg.github.com or subdomain)
