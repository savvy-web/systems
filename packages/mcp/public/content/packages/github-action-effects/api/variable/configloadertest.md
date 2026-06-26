---
id: packages/github-action-effects/api/variable/configloadertest
title: "ConfigLoaderTest — github-action-effects variable"
summary: "Test implementation for ConfigLoader."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ConfigLoaderTest

Test implementation for [ConfigLoader](silk://packages/github-action-effects/api/class/configloader).

```ts
ConfigLoaderTest: {
  readonly layer: (state: ConfigLoaderTestState) => Layer.Layer<ConfigLoader>; /** Create a fresh empty test state. */
  readonly empty: () => ConfigLoaderTestState;
}
```
