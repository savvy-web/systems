---
id: packages/github-action-effects/api/interface/registrytarget
title: "RegistryTarget — github-action-effects interface"
summary: "Target registry for publishing."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# RegistryTarget

Target registry for publishing.

```ts
interface RegistryTarget
```

## Members

### access

```ts
readonly access?: "public" | "restricted";
```

### packageManager

```ts
readonly packageManager?: "npm" | "pnpm" | "yarn" | "bun";
```

Package manager whose bundled `npm` executor runs the publish. Matches the `packageManager` option on `PackagePublish.publish` — non-`npm` dispatchers (`pnpm dlx npm`, `yarn npm`, `bun x npm`) fetch a fresh npm so the OIDC trusted-publisher exchange works on runners pinned to an older bundled npm. Defaults to bare `npm`.

### registry

```ts
readonly registry: string;
```

### tag

```ts
readonly tag?: string;
```

### token

```ts
readonly token: Redacted.Redacted<string>;
```
