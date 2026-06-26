---
id: packages/tsdown-plugins/api/interface/resolvedgroup
title: "ResolvedGroup — tsdown-plugins interface"
summary: "A distinct byte-variant build group (one per distinct resolved name)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ResolvedGroup

A distinct byte-variant build group (one per distinct resolved name).

```ts
interface ResolvedGroup
```

## Members

### dir

```ts
readonly dir: string;
```

The group's pkg output dir, relative to the package root.

### id

```ts
readonly id: string;
```

Folder id; the group's output dir nests this id under dist/prod, with a pkg subfolder.

### name

```ts
readonly name: string;
```

The `package.json.name` this group's manifest carries.
