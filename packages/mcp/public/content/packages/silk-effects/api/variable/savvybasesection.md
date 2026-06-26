---
id: packages/silk-effects/api/variable/savvybasesection
title: "SavvyBaseSection — silk-effects variable"
summary: "Section identity for the shared package-manager preamble. `toolName` is `\"savvy-base\"`; pair with savvyBasePreamble to build the block:"
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SavvyBaseSection

Section identity for the shared package-manager preamble. `toolName` is `"savvy-base"`; pair with [savvyBasePreamble](silk://packages/silk-effects/api/function/savvybasepreamble) to build the block:

```ts
SavvyBaseSection: ShellSectionDefinition
```

## Examples

```ts
const block = SavvyBaseSection.block(savvyBasePreamble());

```
