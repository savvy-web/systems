---
id: packages/tsdown-plugins/api/interface/warningsuppressionrule
title: "WarningSuppressionRule — tsdown-plugins interface"
summary: "An api-extractor message-suppression rule. messageId is exact-matched; pattern (regex or substring) is AND-matched against the text."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# WarningSuppressionRule

An api-extractor message-suppression rule. messageId is exact-matched; pattern (regex or substring) is AND-matched against the text.

```ts
interface WarningSuppressionRule
```

## Members

### messageId

```ts
readonly messageId: string;
```

### pattern

```ts
readonly pattern?: string | undefined;
```
