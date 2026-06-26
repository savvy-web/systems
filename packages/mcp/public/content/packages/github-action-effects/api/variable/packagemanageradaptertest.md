---
id: packages/github-action-effects/api/variable/packagemanageradaptertest
title: "PackageManagerAdapterTest — github-action-effects variable"
summary: "Test implementation for PackageManagerAdapter."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackageManagerAdapterTest

Test implementation for [PackageManagerAdapter](silk://packages/github-action-effects/api/class/packagemanageradapter).

```ts
PackageManagerAdapterTest: {
  readonly layer: (state: PackageManagerAdapterTestState) => Layer.Layer<PackageManagerAdapter>; /** Create a fresh test state with pnpm defaults. */
  readonly empty: () => PackageManagerAdapterTestState;
}
```
