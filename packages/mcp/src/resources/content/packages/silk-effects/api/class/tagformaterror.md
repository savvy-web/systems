---
id: packages/silk-effects/api/class/tagformaterror
title: "TagFormatError — silk-effects class"
summary: "Raised when a git tag string cannot be formatted for the given package name and version."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# TagFormatError

Raised when a git tag string cannot be formatted for the given package name and version.

```ts
class TagFormatError extends TagFormatError_base<{
    readonly name: string;
    readonly version: string;
    readonly reason: string;
}>
```

## Members

### message

```ts
get message(): string;
```

### name

```ts
readonly name: string;
```

### reason

```ts
readonly reason: string;
```

### version

```ts
readonly version: string;
```
