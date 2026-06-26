---
id: packages/tsdown-plugins/api/class/buildcollector
title: "BuildCollector — tsdown-plugins class"
summary: "Stateful build-event accumulator. The write surface is synchronous so it can be called directly from tsdown's customLogger and API Extractor's messageCallback…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# BuildCollector

Stateful build-event accumulator. The write surface is synchronous so it can be called directly from tsdown's customLogger and API Extractor's messageCallback (both invoked synchronously). `snapshot` builds the immutable [BuildReport](silk://packages/tsdown-plugins/api/class/buildreport) the Effect render pipeline consumes.

```ts
class BuildCollector
```

## Members

### recordEmitted

```ts
recordEmitted(groupId: string, pass: PassKind, file: EmittedFile): void;
```

### recordError

```ts
recordError(groupId: string, entry: DiagnosticInput): void;
```

### recordPassTiming

```ts
recordPassTiming(groupId: string, pass: PassKind, ms: number): void;
```

### recordSuppressed

```ts
recordSuppressed(groupId: string, entry: DiagnosticInput): void;
```

### recordWarning

```ts
recordWarning(groupId: string, entry: DiagnosticInput): void;
```

### registerGroup

```ts
registerGroup(groupId: string, entries: ReadonlyArray<string>): void;
```

### snapshot

```ts
snapshot(packageName: string): ReadonlyArray<BuildReport>;
```
