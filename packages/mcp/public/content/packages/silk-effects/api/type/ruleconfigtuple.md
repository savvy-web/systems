---
id: packages/silk-effects/api/type/ruleconfigtuple
title: "RuleConfigTuple — silk-effects type"
summary: "Rule configuration tuple."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# RuleConfigTuple

Rule configuration tuple.

```ts
type RuleConfigTuple<T = unknown> = readonly [RuleSeverity] | readonly [RuleSeverity, RuleApplicability] | readonly [RuleSeverity, RuleApplicability, T];
```
