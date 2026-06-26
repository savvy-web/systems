---
id: packages/rspress-builder/api/interface/rspressbundleoptions
title: "RspressBundleOptions — rspress-builder interface"
summary: "Per-bundle externals tuning for a single partition (plugin or runtime)."
tier: packages
source: generated
tags: [rspress-builder, api]
priority: 0.3
related: []
---

# RspressBundleOptions

Per-bundle externals tuning for a single partition (plugin or runtime).

```ts
interface RspressBundleOptions
```

## Members

### externals

```ts
readonly externals?: ReadonlyArray<string>;
```

Additional externals merged with the built-ins for that bundle.
