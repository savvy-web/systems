---
id: packages/tsdown-plugins/api/function/resolvetargets
title: "resolveTargets — tsdown-plugins function"
summary: "Resolve a `publishConfig.targets` map into the distinct groups to build and every target bound to one. Pure; throws ConfigValidationError on structurally-inval…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# resolveTargets

Resolve a `publishConfig.targets` map into the distinct groups to build and every target bound to one. Pure; throws [ConfigValidationError](silk://packages/tsdown-plugins/api/class/configvalidationerror) on structurally-invalid config.

```ts
function resolveTargets(options: {
  targets: PublishTargets;
  baseName: string;
}): TargetResolution;
```
