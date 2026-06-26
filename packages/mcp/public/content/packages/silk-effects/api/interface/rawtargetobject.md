---
id: packages/silk-effects/api/interface/rawtargetobject
title: "RawTargetObject — silk-effects interface"
summary: "A single object-form publish target in the `publishConfig.targets` map (mirrors the bundler's `PublishTargetObject`)."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# RawTargetObject

A single object-form publish target in the `publishConfig.targets` map (mirrors the bundler's `PublishTargetObject`).

```ts
interface RawTargetObject
```

## Members

### from

```ts
readonly from?: string;
```

Reuse another target's group bytes. Mutually exclusive with `name`.

### name

```ts
readonly name?: string;
```

Name override for this target's own group. Mutually exclusive with `from`.

### registry

```ts
readonly registry?: string;
```

Registry endpoint. Defaulted for the well-known `npm`/`github` keys.
