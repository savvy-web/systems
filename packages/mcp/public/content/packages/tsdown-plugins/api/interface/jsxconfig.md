---
id: packages/tsdown-plugins/api/interface/jsxconfig
title: "JsxConfig — tsdown-plugins interface"
summary: "Resolved JSX transform settings, mirroring the subset of rolldown's JsxOptions the bundler forwards."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# JsxConfig

Resolved JSX transform settings, mirroring the subset of rolldown's JsxOptions the bundler forwards.

```ts
interface JsxConfig
```

## Members

### importSource

```ts
readonly importSource?: string | undefined;
```

The JSX import source for the automatic runtime (e.g. "react", "preact").

### runtime

```ts
readonly runtime?: "classic" | "automatic" | undefined;
```

"automatic" auto-imports the JSX factories (react-jsx); "classic" does not (React.createElement).
