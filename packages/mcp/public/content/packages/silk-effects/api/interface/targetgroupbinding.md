---
id: packages/silk-effects/api/interface/targetgroupbinding
title: "TargetGroupBinding — silk-effects interface"
summary: "A resolved byte-variant group from the bundler's `dist/prod/targets.json` binding."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# TargetGroupBinding

A resolved byte-variant group from the bundler's `dist/prod/targets.json` binding.

```ts
interface TargetGroupBinding
```

## Members

### dir

```ts
readonly dir: string;
```

The group's pkg output dir, relative to the package root (e.g. `dist/prod/npm/pkg`).

### id

```ts
readonly id: string;
```

Group folder id; the group's bytes live at `dir`.

### name

```ts
readonly name: string;
```

The `package.json.name` this group's manifest carries.
