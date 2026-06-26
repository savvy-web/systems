---
id: packages/tsdown-plugins/api/interface/buildissues
title: "BuildIssues — tsdown-plugins interface"
summary: "The aggregated build-issues artifact written to `dist/<target>/issues.json`."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# BuildIssues

The aggregated build-issues artifact written to `dist/<target>/issues.json`.

```ts
interface BuildIssues
```

## Members

### errors

```ts
errors: PlainDiagnostic[];
```

### generatedAt

```ts
generatedAt: string;
```

### package

```ts
package: string;
```

### suppressed

```ts
suppressed: PlainDiagnostic[];
```

### target

```ts
target: "dev" | "prod";
```

### warnings

```ts
warnings: PlainDiagnostic[];
```
