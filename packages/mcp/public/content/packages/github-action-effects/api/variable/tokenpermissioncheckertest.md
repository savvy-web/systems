---
id: packages/github-action-effects/api/variable/tokenpermissioncheckertest
title: "TokenPermissionCheckerTest — github-action-effects variable"
summary: "Test implementation for TokenPermissionChecker."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TokenPermissionCheckerTest

Test implementation for [TokenPermissionChecker](silk://packages/github-action-effects/api/class/tokenpermissionchecker).

```ts
TokenPermissionCheckerTest: {
  readonly layer: (state: TokenPermissionCheckerTestState) => Layer.Layer<TokenPermissionChecker>; /** Create a fresh test state with no permissions. */
  readonly empty: () => TokenPermissionCheckerTestState;
}
```
