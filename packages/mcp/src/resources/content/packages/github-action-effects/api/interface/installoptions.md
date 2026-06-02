---
id: packages/github-action-effects/api/interface/installoptions
title: "InstallOptions — github-action-effects interface"
summary: "Options for package installation."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# InstallOptions

Options for package installation.

```ts
interface InstallOptions
```

## Members

### cwd

```ts
readonly cwd?: string;
```

Working directory for installation.

### frozen

```ts
readonly frozen?: boolean;
```

Whether to use frozen/immutable lockfile. Defaults to true.
