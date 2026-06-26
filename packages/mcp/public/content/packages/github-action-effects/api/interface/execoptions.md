---
id: packages/github-action-effects/api/interface/execoptions
title: "ExecOptions — github-action-effects interface"
summary: "Options for command execution."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ExecOptions

Options for command execution.

```ts
interface ExecOptions
```

## Members

### cwd

```ts
readonly cwd?: string;
```

### env

```ts
readonly env?: Record<string, string>;
```

### silent

```ts
readonly silent?: boolean;
```

### streaming

```ts
readonly streaming?: boolean;
```

When true, forward stdout/stderr to `process.stdout`/`process.stderr` in real-time while still capturing the output for the return value. Useful for long-running commands where real-time log visibility is needed.

### timeout

```ts
readonly timeout?: number;
```
