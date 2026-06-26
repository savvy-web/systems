---
id: packages/tsdown-plugins/api/interface/runexebuildoptions
title: "RunExeBuildOptions — tsdown-plugins interface"
summary: "Options for compiling SEA binaries."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# RunExeBuildOptions

Options for compiling SEA binaries.

```ts
interface RunExeBuildOptions
```

## Members

### build

```ts
readonly build?: ExeBuild | undefined;
```

Injectable tsdown build (defaults to tsdown's build function).

### collector

```ts
readonly collector?: BuildCollector | undefined;
```

When set with groupId, muzzle tsdown and record an "exe" pass into this collector.

### cwd

```ts
readonly cwd: string;
```

### groupId

```ts
readonly groupId?: string | undefined;
```

Target-group id the exe pass belongs to (required to record into the collector).

### outDir

```ts
readonly outDir: string;
```

Directory the binaries are emitted into (e.g. dist/dev/pkg/bin).

### specs

```ts
readonly specs: ReadonlyArray<NormalizedExe>;
```

One fully-resolved spec per binary.

### verbose

```ts
readonly verbose?: boolean | undefined;
```

Compute gzip sizes (verbose render).
