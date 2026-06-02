---
id: packages/silk-effects/api/class/workspaceanalysis
title: "WorkspaceAnalysis — silk-effects class"
summary: "Full workspace analysis result containing all analyzed workspaces and project-level configuration."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# WorkspaceAnalysis

Full workspace analysis result containing all analyzed workspaces and project-level configuration.

```ts
class WorkspaceAnalysis extends WorkspaceAnalysis_base
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

### findWorkspace

```ts
findWorkspace(name: string): Option.Option<AnalyzedWorkspace>;
```

### hasChangesets

```ts
get hasChangesets(): boolean;
```

### isSilk

```ts
get isSilk(): boolean;
```

### pretty

```ts
static pretty: (self: WorkspaceAnalysis) => string;
```

Pretty-print a [WorkspaceAnalysis](silk://packages/silk-effects/api/class/workspaceanalysis) instance.

### publishableWorkspaces

```ts
get publishableWorkspaces(): ReadonlyArray<AnalyzedWorkspace>;
```

### releasableWorkspaces

```ts
get releasableWorkspaces(): ReadonlyArray<AnalyzedWorkspace>;
```

### rootWorkspace

```ts
get rootWorkspace(): Option.Option<AnalyzedWorkspace>;
```

### taggedWorkspaces

```ts
get taggedWorkspaces(): ReadonlyArray<AnalyzedWorkspace>;
```

### toString

```ts
toString(): string;
```

### versionedWorkspaces

```ts
get versionedWorkspaces(): ReadonlyArray<AnalyzedWorkspace>;
```
