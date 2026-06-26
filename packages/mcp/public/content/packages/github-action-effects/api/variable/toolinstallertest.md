---
id: packages/github-action-effects/api/variable/toolinstallertest
title: "ToolInstallerTest — github-action-effects variable"
summary: "Test implementation for ToolInstaller."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ToolInstallerTest

Test implementation for [ToolInstaller](silk://packages/github-action-effects/api/class/toolinstaller).

```ts
ToolInstallerTest: {
  readonly layer: (state: ToolInstallerTestState) => Layer.Layer<ToolInstaller>; /** Create a fresh empty test state. */
  readonly empty: () => ToolInstallerTestState;
}
```
