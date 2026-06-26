---
id: packages/github-action-effects/api/interface/sbomteststate
title: "SbomTestState — github-action-effects interface"
summary: "Mutable state recorded by SbomTest."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SbomTestState

Mutable state recorded by [SbomTest](silk://packages/github-action-effects/api/variable/sbomtest).

```ts
interface SbomTestState
```

## Members

### bomResponse

```ts
readonly bomResponse?: CycloneDXBom;
```

Override the BOM returned from `Sbom.generate`.

### generateCalls

```ts
readonly generateCalls: SbomInput[];
```

Inputs passed to every `Sbom.generate` call.

### jsonResponse

```ts
readonly jsonResponse?: string;
```

Override the JSON returned from `Sbom.serializeJson`.

### saves

```ts
readonly saves: Map<string, CycloneDXBom>;
```

Path → BOM captured by `Sbom.save`.
