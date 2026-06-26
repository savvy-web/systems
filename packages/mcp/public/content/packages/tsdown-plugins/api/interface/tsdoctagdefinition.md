---
id: packages/tsdown-plugins/api/interface/tsdoctagdefinition
title: "TsdocTagDefinition — tsdown-plugins interface"
summary: "A single TSDoc tag definition (parity with api-extractor's TSDoc config)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# TsdocTagDefinition

A single TSDoc tag definition (parity with api-extractor's TSDoc config).

```ts
interface TsdocTagDefinition
```

## Members

### allowMultiple

```ts
readonly allowMultiple?: boolean | undefined;
```

### syntaxKind

```ts
readonly syntaxKind: "block" | "inline" | "modifier";
```

### tagName

```ts
readonly tagName: string;
```
