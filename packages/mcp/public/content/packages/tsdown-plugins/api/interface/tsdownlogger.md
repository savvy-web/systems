---
id: packages/tsdown-plugins/api/interface/tsdownlogger
title: "TsdownLogger — tsdown-plugins interface"
summary: "Structural match for tsdown's Logger interface (tsdown 0.22.x)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# TsdownLogger

Structural match for tsdown's Logger interface (tsdown 0.22.x).

```ts
interface TsdownLogger
```

## Members

### clearScreen

```ts
clearScreen: () => void;
```

### error

```ts
error: (...args: unknown[]) => void;
```

### info

```ts
info: (...args: unknown[]) => void;
```

### level

```ts
level: "info";
```

### success

```ts
success: (...args: unknown[]) => void;
```

### warn

```ts
warn: (...args: unknown[]) => void;
```

### warnOnce

```ts
warnOnce: (...args: unknown[]) => void;
```
