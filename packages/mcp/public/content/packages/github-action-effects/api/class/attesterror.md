---
id: packages/github-action-effects/api/class/attesterror
title: "AttestError — github-action-effects class"
summary: "Errors raised by Attest operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AttestError

Errors raised by [Attest](silk://packages/github-action-effects/api/class/attest) operations.

```ts
class AttestError extends AttestError_base<{
  readonly reason: "build" | "save" | "oidc" | "sign" | "upload";
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
readonly reason: "build" | "save" | "oidc" | "sign" | "upload";
```
