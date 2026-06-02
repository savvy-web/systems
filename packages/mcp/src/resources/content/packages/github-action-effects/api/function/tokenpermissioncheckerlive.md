---
id: packages/github-action-effects/api/function/tokenpermissioncheckerlive
title: "TokenPermissionCheckerLive — github-action-effects function"
summary: "Live implementation of TokenPermissionChecker. Constructed with a granted permissions record (typically from InstallationToken.permissions)."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TokenPermissionCheckerLive

Live implementation of [TokenPermissionChecker](silk://packages/github-action-effects/api/class/tokenpermissionchecker). Constructed with a granted permissions record (typically from [InstallationToken](silk://packages/github-action-effects/api/variable/installationtoken).permissions).

```ts
TokenPermissionCheckerLive: (permissions: Record<string, string>) => Layer.Layer<TokenPermissionChecker>
```
