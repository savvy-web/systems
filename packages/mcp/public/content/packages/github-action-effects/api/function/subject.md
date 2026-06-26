---
id: packages/github-action-effects/api/function/subject
title: "subject — github-action-effects function"
summary: "Build a single-subject InTotoSubject from a name and sha256 digest. Convenience for the common case of attesting one artifact."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# subject

Build a single-[subject](silk://packages/github-action-effects/api/function/subject) [InTotoSubject](silk://packages/github-action-effects/api/class/intotosubject) from a name and sha256 digest. Convenience for the common case of attesting one artifact.

```ts
subject: (name: string, sha256: string) => InTotoSubject
```

## Parameters

- `name` `string` — PURL or other identifier (e.g. `pkg:npm/@scope/pkg@1.0.0`).
- `sha256` `string` — 64-char lowercase hex SHA-256 digest of the artifact.
