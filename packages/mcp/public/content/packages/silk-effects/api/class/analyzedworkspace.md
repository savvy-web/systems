---
id: packages/silk-effects/api/class/analyzedworkspace
title: "AnalyzedWorkspace — silk-effects class"
summary: "A fully analyzed workspace with publish targets, versioning status, and release group membership."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# AnalyzedWorkspace

A fully analyzed workspace with publish targets, versioning status, and release group membership.

```ts
class AnalyzedWorkspace extends AnalyzedWorkspace_base
```

## Members

### [Equal.symbol]

```ts
[Equal.symbol](that: Equal.Equal): boolean;
```

### [Hash.symbol]

```ts
[Hash.symbol](): number;
```

### findByName

```ts
static findByName: {
    (name: string): (workspaces: ReadonlyArray<AnalyzedWorkspace>) => Option.Option<AnalyzedWorkspace>;
    (workspaces: ReadonlyArray<AnalyzedWorkspace>, name: string): Option.Option<AnalyzedWorkspace>;
  };
```

### hasTarget

```ts
hasTarget(shorthand: "npm" | "github" | "jsr"): boolean;
```

### isFixed

```ts
get isFixed(): boolean;
```

### isLinked

```ts
get isLinked(): boolean;
```

### isPublishable

```ts
get isPublishable(): boolean;
```

### isReleasable

```ts
get isReleasable(): boolean;
```

### isRoot

```ts
get isRoot(): boolean;
```

### pretty

```ts
static pretty: (self: AnalyzedWorkspace) => string;
```

Pretty-print an [AnalyzedWorkspace](silk://packages/silk-effects/api/class/analyzedworkspace) instance.

### publishable

```ts
static publishable(workspaces: ReadonlyArray<AnalyzedWorkspace>): ReadonlyArray<AnalyzedWorkspace>;
```

### publishesTo

```ts
publishesTo(registry: string): boolean;
```

### releasable

```ts
static releasable(workspaces: ReadonlyArray<AnalyzedWorkspace>): ReadonlyArray<AnalyzedWorkspace>;
```

### targetFor

```ts
targetFor(registry: string): Option.Option<PublishTarget>;
```

### toJSON

```ts
toJSON(): unknown;
```

### toString

```ts
toString(): string;
```
