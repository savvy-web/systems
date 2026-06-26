---
id: packages/github-action-effects/api/class/sigstoresignererror
title: "SigstoreSignerError — github-action-effects class"
summary: "Errors raised by SigstoreSigner. - `\"sign\"` — Fulcio / FulcioSigner failed to produce a signature - `\"witness\"` — Rekor failed to issue a transparency-log entr…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SigstoreSignerError

Errors raised by [SigstoreSigner](silk://packages/github-action-effects/api/class/sigstoresigner). - `"sign"` — Fulcio / FulcioSigner failed to produce a signature - `"witness"` — Rekor failed to issue a transparency-log entry - `"bundle"` — bundle JSON could not be produced from the protobuf

```ts
class SigstoreSignerError extends SigstoreSignerError_base<{
  readonly reason: "sign" | "witness" | "bundle";
  readonly message: string;
  readonly cause?: unknown;
}>
```

## Members

### cause

```ts
readonly cause?: unknown;
```

### message

```ts
readonly message: string;
```

### reason

```ts
readonly reason: "sign" | "witness" | "bundle";
```
