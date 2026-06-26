---
id: packages/github-action-builder/api/interface/githubactionoptions
title: "GitHubActionOptions — github-action-builder interface"
summary: "Options for creating a GitHubAction builder instance."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# GitHubActionOptions

Options for creating a [GitHubAction](silk://packages/github-action-builder/api/class/githubaction) builder instance.

```ts
interface GitHubActionOptions
```

## Members

### clean

```ts
clean?: boolean;
```

Clean output directory before building.

### config

```ts
config?: Partial<ConfigInput> | string;
```

Configuration object or path to config file.

### cwd

```ts
cwd?: string;
```

Working directory for the build.

### layer

```ts
layer?: Layer.Layer<ConfigService | ValidationService | BuildService | PersistLocalService>;
```

Custom Effect Layer to use instead of the default [AppLayer](silk://packages/github-action-builder/api/variable/applayer).

### skipValidation

```ts
skipValidation?: boolean;
```

Skip validation before building.
