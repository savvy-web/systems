---
id: packages/github-action-effects/api/class/sigstorebundle
title: "SigstoreBundle — github-action-effects class"
summary: "A Sigstore bundle — the wire format for attestations. The exact `verificationMaterial` and `dsseEnvelope` shapes are defined by the sigstore protobuf-specs; we…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SigstoreBundle

A Sigstore bundle — the wire format for attestations. The exact `verificationMaterial` and `dsseEnvelope` shapes are defined by the sigstore protobuf-specs; we model them as `unknown` at this layer and delegate construction to `@sigstore/sign`. The bundle is opaque to callers that just want to upload it.

```ts
class SigstoreBundle extends SigstoreBundle_base
```
