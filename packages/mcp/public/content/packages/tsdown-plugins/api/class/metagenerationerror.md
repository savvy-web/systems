---
id: packages/tsdown-plugins/api/class/metagenerationerror
title: "MetaGenerationError — tsdown-plugins class"
summary: "API Extractor meta generation failed for an entry."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# MetaGenerationError

API Extractor meta generation failed for an entry.

```ts
class MetaGenerationError extends MetaGenerationError_base<{
  readonly entry: string;
  readonly reason: string;
}>
```

## Members

### entry

```ts
readonly entry: string;
```

### message

```ts
get message(): string;
```

### reason

```ts
readonly reason: string;
```
