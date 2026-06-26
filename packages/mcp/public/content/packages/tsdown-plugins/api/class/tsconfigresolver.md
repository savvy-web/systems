---
id: packages/tsdown-plugins/api/class/tsconfigresolver
title: "TsconfigResolver — tsdown-plugins class"
summary: "Resolves a TypeScript `ParsedCommandLine` to a portable, JSON-serializable tsconfig (compilerOptions-only) for virtual TypeScript environments."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# TsconfigResolver

Resolves a TypeScript `ParsedCommandLine` to a portable, JSON-serializable tsconfig (compilerOptions-only) for virtual TypeScript environments.

```ts
class TsconfigResolver
```

## Members

### convertJsxEmit

```ts
static convertJsxEmit(jsx: JsxEmit | undefined): string | undefined;
```

Converts a `JsxEmit` enum value to its string form (e.g. `preserve`, `react-jsx`).

### convertLibReference

```ts
static convertLibReference(lib: string): string;
```

Converts a lib reference to its canonical short name.

### convertModuleDetection

```ts
static convertModuleDetection(detection: ModuleDetectionKind | undefined): string | undefined;
```

Converts a `ModuleDetectionKind` enum value to its string form (e.g. `force`).

### convertModuleKind

```ts
static convertModuleKind(module: ModuleKind | undefined): string | undefined;
```

Converts a `ModuleKind` enum value to its string form (e.g. `nodenext`).

### convertModuleResolution

```ts
static convertModuleResolution(resolution: ModuleResolutionKind | undefined): string | undefined;
```

Converts a `ModuleResolutionKind` enum value to its string form (e.g. `nodenext`).

### convertNewLine

```ts
static convertNewLine(newLine: NewLineKind | undefined): string | undefined;
```

Converts a `NewLineKind` enum value to its string form (`lf` or `crlf`).

### convertScriptTarget

```ts
static convertScriptTarget(target: ScriptTarget | undefined): string | undefined;
```

Converts a `ScriptTarget` enum value to its string form (e.g. `es2023`).

### resolve

```ts
resolve(parsed: ParsedCommandLine): PortableTsconfig;
```

Resolves a parsed TypeScript config to a portable, compilerOptions-only tsconfig.
