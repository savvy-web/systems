---
id: packages/tsdown-plugins/api/interface/diagnosticinput
title: "DiagnosticInput — tsdown-plugins interface"
summary: "interface DiagnosticInput from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# DiagnosticInput

```ts
interface DiagnosticInput
```

## Members

### ciFatal

```ts
readonly ciFatal?: boolean;
```

### code

```ts
readonly code?: string;
```

### column

```ts
readonly column?: number;
```

### file

```ts
readonly file?: string;
```

### level

```ts
readonly level: DiagnosticEntry["level"];
```

### line

```ts
readonly line?: number;
```

### source

```ts
readonly source: DiagnosticEntry["source"];
```

### text

```ts
readonly text: string;
```
