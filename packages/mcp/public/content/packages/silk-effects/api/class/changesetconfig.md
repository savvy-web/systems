---
id: packages/silk-effects/api/class/changesetconfig
title: "ChangesetConfig — silk-effects class"
summary: "Accessor service over a workspace root's `.changeset/config.json`."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ChangesetConfig

Accessor service over a workspace root's `.changeset/config.json`.

```ts
class ChangesetConfig extends ChangesetConfig_base
```

## Members

### matches

```ts
static matches(name: string, pattern: string): boolean;
```

The one ignore matcher: exact name match, or `@scope/*` wildcard. `"@scope/*"` matches `"@scope/anything"` (prefix kept includes the trailing slash), but not the bare scope `"@scope"`.
