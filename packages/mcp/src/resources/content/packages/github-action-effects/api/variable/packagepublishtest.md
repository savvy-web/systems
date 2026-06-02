---
id: packages/github-action-effects/api/variable/packagepublishtest
title: "PackagePublishTest — github-action-effects variable"
summary: "Test implementation for PackagePublish."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackagePublishTest

Test implementation for [PackagePublish](silk://packages/github-action-effects/api/class/packagepublish).

```ts
PackagePublishTest: {
    readonly empty: () => {
        state: PackagePublishTestState;
        layer: Layer.Layer<PackagePublish>;
    };
    readonly layer: (overrides?: Partial<Pick<PackagePublishTestState, "packResult" | "integrityMatch" | "publishedVersions" | "dryRunOk">>) => {
        state: PackagePublishTestState;
        layer: Layer.Layer<PackagePublish>;
    };
}
```
