---
id: packages/tsdown-plugins/api/interface/publishtargetobject
title: "PublishTargetObject — tsdown-plugins interface"
summary: "A single object-form publish target. Uses `from` XOR `name` (never both)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# PublishTargetObject

A single object-form publish target. Uses `from` XOR `name` (never both).

```ts
interface PublishTargetObject
```

## Members

### from

```ts
readonly from?: string | undefined;
```

Reuse another target's group bytes (deploy them to this registry). Mutually exclusive with `name`.

### name

```ts
readonly name?: string | undefined;
```

Name override for this target's own group. Mutually exclusive with `from`.

### registry

```ts
readonly registry?: string | undefined;
```

Registry endpoint. Required for custom keys; defaulted for `npm`/`github`.
