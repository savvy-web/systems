---
id: packages/github-action-effects/api/variable/packagemanageradapterlive
title: "PackageManagerAdapterLive — github-action-effects variable"
summary: "Live implementation of PackageManagerAdapter. Depends on CommandRunner for executing commands and FileSystem for reading package.json and checking lockfiles."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackageManagerAdapterLive

Live implementation of [PackageManagerAdapter](silk://packages/github-action-effects/api/class/packagemanageradapter). Depends on [CommandRunner](silk://packages/github-action-effects/api/class/commandrunner) for executing commands and FileSystem for reading package.json and checking lockfiles.

```ts
PackageManagerAdapterLive: Layer.Layer<PackageManagerAdapter, never, CommandRunner |
  FileSystem.FileSystem>
```
