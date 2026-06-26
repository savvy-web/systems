---
id: packages/silk-effects/api/class/changesetconfigerror
title: "ChangesetConfigError — silk-effects class"
summary: "Raised when the `.changeset/config.json` file cannot be read or decoded."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ChangesetConfigError

Raised when the `.changeset/config.json` file cannot be read or decoded.

```ts
class ChangesetConfigError extends ChangesetConfigError_base<{
  readonly path: string;
  readonly reason: string;
}>
```

## Members

### message

```ts
get message(): string;
```

### path

```ts
readonly path: string;
```

### reason

```ts
readonly reason: string;
```
