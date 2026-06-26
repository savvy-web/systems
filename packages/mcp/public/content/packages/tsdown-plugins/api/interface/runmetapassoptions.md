---
id: packages/tsdown-plugins/api/interface/runmetapassoptions
title: "RunMetaPassOptions — tsdown-plugins interface"
summary: "Options for the meta-pass orchestrator."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# RunMetaPassOptions

Options for the meta-pass orchestrator.

```ts
interface RunMetaPassOptions
```

## Members

### ci

```ts
readonly ci: boolean;
```

### collector

```ts
readonly collector: BuildCollector;
```

### cwd

```ts
readonly cwd: string;
```

### entries

```ts
readonly entries: Record<string, string>;
```

### exportsMap

```ts
readonly exportsMap: Record<string, string> | undefined;
```

### generateMeta

```ts
readonly generateMeta?: (o: GenerateMetaOptions) => Promise<MetaResult>;
```

Injectable for tests; defaults to the real [generateMeta](silk://packages/tsdown-plugins/api/function/generatemeta).

### groups

```ts
readonly groups: ReadonlyArray<{
    id: string;
    name: string;
  }>;
```

### meta

```ts
readonly meta: MetaOptions;
```

### overrides

```ts
readonly overrides?: ReadonlyArray<{
    entries: ReadonlyArray<string>;
    outSubdir?: string | undefined;
  }> | undefined;
```

### packageName

```ts
readonly packageName: string;
```

### resolveNextVersions

```ts
readonly resolveNextVersions?: (cwd: string) => Promise<{
    versions: ReadonlyMap<string, string>;
  }>;
```

Injectable for tests; defaults to the real [resolveNextVersions](silk://packages/tsdown-plugins/api/function/resolvenextversions). Only called when optimistic.

### tsconfigPath

```ts
readonly tsconfigPath: string;
```
