---
id: packages/github-action-effects/api/interface/inflightpackage
title: "InFlightPackage — github-action-effects interface"
summary: "A sibling package being released in the same wave as the root — not yet on the registry, so any registry-based dependency resolver cannot see it. The Sbom serv…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# InFlightPackage

A sibling package being released in the same wave as the root — not yet on the registry, so any registry-based dependency resolver cannot see it. The [Sbom](silk://packages/github-action-effects/api/class/sbom) service uses this list to synthesize the component entry the registry would otherwise provide.

```ts
interface InFlightPackage
```

## Members

### license

```ts
readonly license?: string;
```

### name

```ts
readonly name: string;
```

### version

```ts
readonly version: string;
```
