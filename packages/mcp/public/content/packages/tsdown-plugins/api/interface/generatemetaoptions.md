---
id: packages/tsdown-plugins/api/interface/generatemetaoptions
title: "GenerateMetaOptions — tsdown-plugins interface"
summary: "interface GenerateMetaOptions from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# GenerateMetaOptions

```ts
interface GenerateMetaOptions
```

## Members

### aeInputDir

```ts
readonly aeInputDir?: string | undefined;
```

Per-module declarations dir used ONLY for a second, diagnostics-only API Extractor run that resolves accurate per-file source locations. The shipped api-model is still produced from `dtsDir` (the bundled dts), so it is unchanged. When omitted or equal to `dtsDir`, a single run over `dtsDir` produces both model and diagnostics (legacy behavior).

### ci

```ts
readonly ci?: boolean | undefined;
```

When true (CI), forgotten exports become a hard build error.

### cwd

```ts
readonly cwd: string;
```

### dtsDir

```ts
readonly dtsDir: string;
```

Directory holding the tsdown-emitted per-file .d.ts (e.g. dist/dev/pkg).

### entries

```ts
readonly entries: Record<string, string>;
```

Map of entry name to the .d.ts basename (without extension) inside dtsDir.

### exportPaths

```ts
readonly exportPaths: Record<string, string>;
```

Map of entry name to its export path (".", "./sub").

### localPaths

```ts
readonly localPaths: ReadonlyArray<string>;
```

Directories (relative to cwd) to copy the meta bundle into.

### manifestTransform

```ts
readonly manifestTransform?: ((pkg: Record<string, unknown>) => Record<string, unknown>) | undefined;
```

Optional transform applied to the bundle `package.json` (read from `dtsDir`) before it is written to `outMetaDir` and copied into `localPaths`. Used for the optimistic next-version rewrite. When omitted, the package.json is copied verbatim.

### onMessage

```ts
readonly onMessage?: ((entry: DiagnosticInput) => void) | undefined;
```

When set, API Extractor warnings/errors are routed here (and suppressed from console).

### onSuppressed

```ts
readonly onSuppressed?: ((entry: DiagnosticInput) => void) | undefined;
```

When set, messages matched by `suppressWarnings` are routed here for accounting.

### outMetaDir

```ts
readonly outMetaDir: string;
```

Where to write the meta bundle (.api.json + package.json + tsconfig.json).

### packageName

```ts
readonly packageName: string;
```

### tsconfigPath

```ts
readonly tsconfigPath: string;
```

Resolved tsconfig (from [writeResolvedTsconfig](silk://packages/tsdown-plugins/api/function/writeresolvedtsconfig)) for the api-extractor compiler.

### tsdoc

```ts
readonly tsdoc: NormalizedMeta["tsdoc"];
```
