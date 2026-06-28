---
id: packages/bundler/api/interface/parsedargs
title: "ParsedArgs — bundler interface"
summary: "interface ParsedArgs from @savvy-web/bundler."
tier: packages
source: generated
tags: [bundler, api]
priority: 0.3
related: []
---

# ParsedArgs

```ts
interface ParsedArgs
```

## Members

### noExe

```ts
readonly noExe: boolean;
```

Skip the SEA compile step of a dev/prod [build](silk://packages/bundler/api/function/build) (the manifest is still programmed). Used by `prepare`.

### target

```ts
readonly target: "dev" | "prod" | "meta" | "exe";
```

### verbose

```ts
readonly verbose: boolean;
```

### watch

```ts
readonly watch: boolean;
```
