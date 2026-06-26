---
id: packages/bundler/api/interface/outputconfig
title: "OutputConfig — bundler interface"
summary: "interface OutputConfig from @savvy-web/bundler."
tier: packages
source: generated
tags: [bundler, api]
priority: 0.3
related: []
---

# OutputConfig

```ts
interface OutputConfig
```

## Members

### console

```ts
readonly console?: {
    readonly human?: boolean;
    readonly agent?: boolean;
    readonly ci?: boolean;
  };
```

### format

```ts
readonly format?: "terminal" | "json" | "markdown" | "ci-annotations" | "silent";
```
