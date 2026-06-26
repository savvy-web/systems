---
id: packages/tsdown-plugins/api/interface/nextversions
title: "NextVersions — tsdown-plugins interface"
summary: "Result of resolving next release versions for a workspace."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# NextVersions

Result of resolving next release versions for a workspace.

```ts
interface NextVersions
```

## Members

### root

```ts
readonly root: string;
```

Monorepo root containing `.changeset/` (or `cwd` when no workspace was found).

### versions

```ts
readonly versions: ReadonlyMap<string, string>;
```

Canonical package name `->` next release version (current version when unbumped).
