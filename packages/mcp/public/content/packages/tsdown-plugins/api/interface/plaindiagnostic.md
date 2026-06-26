---
id: packages/tsdown-plugins/api/interface/plaindiagnostic
title: "PlainDiagnostic — tsdown-plugins interface"
summary: "A diagnostic flattened to a plain JSON object (only defined fields are present)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# PlainDiagnostic

A diagnostic flattened to a plain JSON object (only defined fields are present).

```ts
interface PlainDiagnostic
```

## Members

### ciFatal

```ts
ciFatal?: boolean;
```

### code

```ts
code?: string;
```

### column

```ts
column?: number;
```

### file

```ts
file?: string;
```

### level

```ts
level: DiagnosticEntry["level"];
```

### line

```ts
line?: number;
```

### source

```ts
source: DiagnosticEntry["source"];
```

### text

```ts
text: string;
```
