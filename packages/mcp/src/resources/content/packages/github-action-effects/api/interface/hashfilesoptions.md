---
id: packages/github-action-effects/api/interface/hashfilesoptions
title: "HashFilesOptions — github-action-effects interface"
summary: "Options for Glob."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# HashFilesOptions

Options for [Glob](silk://packages/github-action-effects/api/class/glob).

```ts
interface HashFilesOptions
```

## Members

### followSymbolicLinks

```ts
readonly followSymbolicLinks?: boolean;
```

Follow symlinks while walking. Default true.

### workspace

```ts
readonly workspace?: string;
```

Workspace root; files outside it are skipped. Defaults to `process.env.GITHUB_WORKSPACE`, matching `@actions/glob`'s `hashFiles`.
