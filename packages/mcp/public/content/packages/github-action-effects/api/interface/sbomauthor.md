---
id: packages/github-action-effects/api/interface/sbomauthor
title: "SbomAuthor — github-action-effects interface"
summary: "An author of the SBOM document itself. Maps to a CycloneDX `metadata.authors` entry — the NTIA \"author of SBOM data\" element, distinct from the `SbomInput.root…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SbomAuthor

An author of the SBOM document itself. Maps to a CycloneDX `metadata.authors` entry — the NTIA "author of SBOM data" element, distinct from the `SbomInput.rootAuthor` that describes the author of the root *component*.

```ts
interface SbomAuthor
```

## Members

### email

```ts
readonly email?: string;
```

### name

```ts
readonly name?: string;
```

### phone

```ts
readonly phone?: string;
```
