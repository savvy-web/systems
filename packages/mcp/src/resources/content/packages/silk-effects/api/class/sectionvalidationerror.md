---
id: packages/silk-effects/api/class/sectionvalidationerror
title: "SectionValidationError — silk-effects class"
summary: "Raised when a SectionBlock fails validation at creation time."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SectionValidationError

Raised when a [SectionBlock](silk://packages/silk-effects/api/class/sectionblock) fails validation at creation time.

```ts
class SectionValidationError extends SectionValidationError_base<{
    readonly toolName: string;
    readonly reason: string;
}>
```

## Members

### message

```ts
get message(): string;
```

### reason

```ts
readonly reason: string;
```

### toolName

```ts
readonly toolName: string;
```
