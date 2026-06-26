---
id: packages/tsdown-plugins/api/variable/configvalidatorlive
title: "ConfigValidatorLive — tsdown-plugins variable"
summary: "Live ConfigValidator: wraps the synchronous rule set, surfacing ConfigValidationError as a typed Effect failure."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ConfigValidatorLive

Live [ConfigValidator](silk://packages/tsdown-plugins/api/class/configvalidator): wraps the synchronous rule set, surfacing [ConfigValidationError](silk://packages/tsdown-plugins/api/class/configvalidationerror) as a typed Effect failure.

```ts
ConfigValidatorLive: Layer.Layer<ConfigValidator, never, never>
```
