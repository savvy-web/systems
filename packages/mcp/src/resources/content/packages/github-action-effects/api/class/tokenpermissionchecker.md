---
id: packages/github-action-effects/api/class/tokenpermissionchecker
title: "TokenPermissionChecker — github-action-effects class"
summary: "Service for checking GitHub token permissions. Provides three enforcement modes: - `check`: Compare granted vs required, return result - `assertSufficient`: Fa…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TokenPermissionChecker

Service for checking GitHub token permissions. Provides three enforcement modes: - `check`: Compare granted vs required, return result - `assertSufficient`: Fail if any required permissions are missing - `assertExact`: Fail if any missing OR extra permissions - `warnOverPermissioned`: Log warnings for extras, never fail

```ts
class TokenPermissionChecker extends TokenPermissionChecker_base
```
