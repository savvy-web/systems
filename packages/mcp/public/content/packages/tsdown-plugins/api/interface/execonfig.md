---
id: packages/tsdown-plugins/api/interface/execonfig
title: "ExeConfig — tsdown-plugins interface"
summary: "One SEA binary to compile."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ExeConfig

One SEA binary to compile.

```ts
interface ExeConfig
```

## Members

### entry

```ts
readonly entry?: string | undefined;
```

Bin entry; defaults to ./src/bin.ts.

### fileName

```ts
readonly fileName: string;
```

Output binary basename (no extension/suffix).

### nodeVersion

```ts
readonly nodeVersion?: string | undefined;
```

Node runtime to embed; defaults to [DEFAULT_EXE_NODE_VERSION](silk://packages/tsdown-plugins/api/variable/default_exe_node_version).

### seaConfig

```ts
readonly seaConfig?: ExeSeaConfig | undefined;
```

seaConfig overrides merged over the defaults.

### targets

```ts
readonly targets?: ReadonlyArray<ExeTargetInput> | undefined;
```

Explicit targets; default inferred from the package os/cpu.
