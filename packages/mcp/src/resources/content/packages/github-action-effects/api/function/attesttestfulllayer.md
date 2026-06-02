---
id: packages/github-action-effects/api/function/attesttestfulllayer
title: "AttestTestFullLayer — github-action-effects function"
summary: "Composed layer that provides `Attest` plus every dependency it declares (`SigstoreSigner`, `OidcTokenIssuer`, `Sbom`, and `GitHubClient`). Use this when you ju…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AttestTestFullLayer

Composed layer that provides `Attest` plus every dependency it declares (`SigstoreSigner`, `OidcTokenIssuer`, `Sbom`, and `GitHubClient`). Use this when you just want to call into `Attest` from a test without wiring four layers by hand.

```ts
AttestTestFullLayer: (state?: AttestTestState) => Layer.Layer<Attest | import("../index.js").GitHubClient | import("../index.js").OidcTokenIssuer | import("../index.js").Sbom | import("../index.js").SigstoreSigner, never, never>
```
