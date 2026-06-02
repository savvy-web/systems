---
id: packages/silk-effects/api/class/sectionwriteerror
title: "SectionWriteError — silk-effects class"
summary: "Raised when a managed section cannot be written to a file."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SectionWriteError

Raised when a managed section cannot be written to a file.

```ts
class SectionWriteError extends SectionWriteError_base<{
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
