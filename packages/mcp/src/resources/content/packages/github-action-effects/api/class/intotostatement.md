---
id: packages/github-action-effects/api/class/intotostatement
title: "InTotoStatement — github-action-effects class"
summary: "In-toto Statement v1. The `predicate` body is intentionally typed as `unknown` — different predicate types (SLSA provenance, CycloneDX SBOM, SPDX, etc.) carry…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# InTotoStatement

In-toto Statement v1. The `predicate` body is intentionally typed as `unknown` — different predicate types (SLSA provenance, CycloneDX SBOM, SPDX, etc.) carry different shapes, and the statement layer doesn't need to introspect them.

```ts
class InTotoStatement extends InTotoStatement_base
```
