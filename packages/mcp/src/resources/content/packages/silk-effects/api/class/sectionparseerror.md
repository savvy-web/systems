---
id: packages/silk-effects/api/class/sectionparseerror
title: "SectionParseError — silk-effects class"
summary: "Raised when a managed section cannot be parsed from a file."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SectionParseError

Raised when a managed section cannot be parsed from a file.

```ts
class SectionParseError extends SectionParseError_base<{
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
