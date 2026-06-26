---
id: packages/tsdown-plugins/api/interface/validationinput
title: "ValidationInput — tsdown-plugins interface"
summary: "The normalized facts the validator checks, assembled by the bundler before any build work."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ValidationInput

The normalized facts the validator checks, assembled by the bundler before any build work.

```ts
interface ValidationInput
```

## Members

### baseName

```ts
readonly baseName: string;
```

### exe

```ts
readonly exe?: ExeConfig | ReadonlyArray<ExeConfig> | undefined;
```

### hasExports

```ts
readonly hasExports: boolean;
```

Whether the package declares an exports map (for the model-without-exports cross-field rule).

### looseFiles

```ts
readonly looseFiles?: LooseFiles | undefined;
```

Standalone bundled output files; validated structurally (extension/format) before any build.

### meta

```ts
readonly meta?: MetaOptions | undefined;
```

### osCpu

```ts
readonly osCpu?: {
    readonly os: ReadonlyArray<string>;
    readonly cpu: ReadonlyArray<string>;
  } | undefined;
```

### targets

```ts
readonly targets?: PublishTargets | undefined;
```
