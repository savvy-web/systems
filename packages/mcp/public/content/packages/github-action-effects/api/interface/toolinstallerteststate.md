---
id: packages/github-action-effects/api/interface/toolinstallerteststate
title: "ToolInstallerTestState — github-action-effects interface"
summary: "Test state for ToolInstaller."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ToolInstallerTestState

Test state for [ToolInstaller](silk://packages/github-action-effects/api/class/toolinstaller).

```ts
interface ToolInstallerTestState
```

## Members

### cacheDirCalls

```ts
readonly cacheDirCalls: Array<{
    sourceDir: string;
    tool: string;
    version: string;
  }>;
```

Calls to `cacheDir`.

### cachedTools

```ts
readonly cachedTools: Map<string, string>;
```

Tools that should be found (tool version to path).

### cacheFileCalls

```ts
readonly cacheFileCalls: Array<{
    sourceFile: string;
    targetFile: string;
    tool: string;
    version: string;
  }>;
```

Calls to `cacheFile`.

### downloadCalls

```ts
readonly downloadCalls: Array<{
    url: string;
  }>;
```

Calls to `download`.

### extractTarCalls

```ts
readonly extractTarCalls: Array<{
    file: string;
    dest?: string;
    flags?: ReadonlyArray<string>;
  }>;
```

Calls to `extractTar`.

### extractZipCalls

```ts
readonly extractZipCalls: Array<{
    file: string;
    dest?: string;
  }>;
```

Calls to `extractZip`.

### findCalls

```ts
readonly findCalls: Array<{
    tool: string;
    version: string;
  }>;
```

Calls to `find`.
