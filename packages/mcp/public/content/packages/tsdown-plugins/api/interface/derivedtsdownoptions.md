---
id: packages/tsdown-plugins/api/interface/derivedtsdownoptions
title: "DerivedTsdownOptions — tsdown-plugins interface"
summary: "The JS pass: per-module JavaScript, no declarations. The build runs TWO tsdown passes per TargetGroup to the SAME outDir: - pass 1 (this) emits per-module JS (…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# DerivedTsdownOptions

The JS pass: per-module JavaScript, no declarations. The build runs TWO tsdown passes per TargetGroup to the SAME outDir: - pass 1 (this) emits per-module JS (`unbundle: true`) with `dts: false` and the default `clean: true`, so it starts from a fresh outDir; - pass 2 (`DerivedDtsPassOptions`) emits ONLY bundled declarations (`unbundle: false`, `dts: { emitDtsOnly: true }`) with `clean: false`, so it must NOT wipe pass 1. We cannot do this in a single pass: tsdown's `unbundle` maps to rolldown `output.preserveModules` for the WHOLE build, and the dts plugin shares it — so one pass gives EITHER per-module JS + per-module dts OR bundled JS + bundled dts. Per-module dts breaks type portability (TS2883) when a package exports only its root entry, and bundling the JS re-bundles workspace consumers (e.g. silk re-bundling silk-effects crashes at runtime). The split keeps per-module JS (no re-bundle hazard) AND bundled, self-contained declarations (no TS2883).

```ts
interface DerivedTsdownOptions
```

## Members

### cjsDefault

```ts
readonly cjsDefault?: boolean | undefined;
```

CJS named-export interop, the equivalent of rslib's cjsInterop: true. This is the real tsdown option name, so it threads straight to the build with no rename. tsdown 0.22.2 finding (verified against the dist Options dts plus the build source): - cjsDefault is a top-level boolean, default true. The build maps it to rolldown's output.exports: cjsDefault ? "auto" : "named", and also silences the MIXED_EXPORT warning. With "auto", a module whose only default-style export is a single default becomes module.exports = value, while named exports stay attached, so a require() call returns the value directly and named exports survive, the interop rslib gives with cjsInterop: true. - We only set it (to true) when cjs is in the format, so esm-only builds leave the tsdown default untouched and stay byte-identical to before.

### clean

```ts
readonly clean: true;
```

JS pass starts fresh; it owns the outDir before the dts pass appends to it.

### define

```ts
readonly define: Record<string, string>;
```

### dts

```ts
readonly dts: false;
```

JS pass emits no declarations; the dts pass owns them.

### entry

```ts
readonly entry: Record<string, string>;
```

### fixedExtension

```ts
readonly fixedExtension: false;
```

Controls output file extensions. Always false for this builder. tsdown 0.22.2 finding (verified by running a real esm+cjs build of a type:module package): - With fixedExtension: false, tsdown emits ESM index.js plus CJS index.cjs for a type:module package in the JS pass. There is no collision: tsdown derives the .js extension for ESM and the .cjs extension for CJS automatically. An earlier M1.1 note claimed the two formats collide on ambient .js under fixedExtension: false; that claim was wrong and is corrected here. - This .js plus .cjs scheme is the one we want. It matches the rslib parity target, where silk's dual-format output uses import: .js, require: .cjs, and a single types: .d.ts, and it matches the flat manifest the emit-manifest transform writes. - Setting fixedExtension: true would instead yield .mjs plus .cjs (and .d.mts plus .d.cts), which is NOT wanted, so dual-format needs no fixedExtension change and we leave it false. - The matching `.d.ts` / `.d.cts` declarations are emitted by the SEPARATE dts pass (see `DerivedDtsPassOptions`), which keeps `unbundle: false` so the declarations are rolled up.

### format

```ts
readonly format: ReadonlyArray<BuildFormat>;
```

### isProd

```ts
readonly isProd: boolean;
```

### minify

```ts
readonly minify: boolean;
```

### outDir

```ts
readonly outDir: string;
```

### platform

```ts
readonly platform: BuildPlatform;
```

### sourcemap

```ts
readonly sourcemap: boolean;
```

### unbundle

```ts
readonly unbundle: true;
```
