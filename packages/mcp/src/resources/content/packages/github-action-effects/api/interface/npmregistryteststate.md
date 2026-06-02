---
id: packages/github-action-effects/api/interface/npmregistryteststate
title: "NpmRegistryTestState — github-action-effects interface"
summary: "Test state for NpmRegistry."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# NpmRegistryTestState

Test state for [NpmRegistry](silk://packages/github-action-effects/api/class/npmregistry).

```ts
interface NpmRegistryTestState
```

## Members

### packages

```ts
readonly packages: Map<string, {
        versions: string[];
        latest: string;
        distTags: Record<string, string>;
        integrity?: string;
        tarball?: string;
    }>;
```
