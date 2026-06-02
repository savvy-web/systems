---
id: packages/github-action-builder/api/interface/loadconfigresult
title: "LoadConfigResult — github-action-builder interface"
summary: "Result of configuration loading."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# LoadConfigResult

Result of configuration loading.

```ts
interface LoadConfigResult
```

## Members

### config

```ts
config: Config;
```

The resolved configuration.

### configPath

```ts
configPath?: string;
```

Path to the config file that was loaded, if any.

### usingDefaults

```ts
usingDefaults: boolean;
```

Whether defaults were used (no config file found).
