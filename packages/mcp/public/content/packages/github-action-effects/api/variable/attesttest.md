---
id: packages/github-action-effects/api/variable/attesttest
title: "AttestTest — github-action-effects variable"
summary: "Test layer factories for Attest."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AttestTest

Test layer factories for [Attest](silk://packages/github-action-effects/api/class/attest).

```ts
AttestTest: {
  layer: (state: AttestTestState) => Layer.Layer<Attest>;
  empty: () => Layer.Layer<Attest>;
}
```
