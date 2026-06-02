---
id: packages/github-action-effects/api/interface/tokenpermissioncheckerteststate
title: "TokenPermissionCheckerTestState — github-action-effects interface"
summary: "Test state for TokenPermissionChecker."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TokenPermissionCheckerTestState

Test state for [TokenPermissionChecker](silk://packages/github-action-effects/api/class/tokenpermissionchecker).

```ts
interface TokenPermissionCheckerTestState
```

## Members

### checkCalls

```ts
readonly checkCalls: Array<Record<string, PermissionLevel>>;
```

### grantedPermissions

```ts
readonly grantedPermissions: Record<string, string>;
```
