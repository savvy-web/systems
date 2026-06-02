---
id: packages/github-action-effects/api/class/packagepublisherror
title: "PackagePublishError — github-action-effects class"
summary: "Error from package publishing operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackagePublishError

Error from package publishing operations.

```ts
class PackagePublishError extends PackagePublishError_base<{
    readonly operation: "setupAuth" | "pack" | "publish" | "publishTarball" | "verifyIntegrity" | "publishToRegistries" | "publishIdempotent" | "dryRun";
    readonly pkg?: string;
    readonly registry?: string;
    readonly reason: string;
    readonly cause?: unknown;
}>
```

## Members

### cause

```ts
readonly cause?: unknown;
```

The underlying error that caused this failure, when one exists — e.g. the `CommandRunnerError` from a failed `npm` invocation, which carries the command's `stderr`, `exitCode`, and `args`. Absent for errors constructed without a source error.

### message

```ts
get message(): string;
```

Human-readable summary: `[<operation>] <reason>`, with the underlying command's stderr (or stdout, as a fallback) appended when `cause` carries one. Output longer than 2000 chars is truncated from the **head** — `npm` writes warnings and notices first and the actual `npm error` lines at the end, so a head-truncation hides the cause while a tail-show surfaces it. A `...[N chars truncated from head]...` marker leads the truncated payload.

### operation

```ts
readonly operation: "setupAuth" | "pack" | "publish" | "publishTarball" | "verifyIntegrity" | "publishToRegistries" | "publishIdempotent" | "dryRun";
```

The operation that failed.

### pkg

```ts
readonly pkg?: string;
```

The package name, if applicable.

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.

### registry

```ts
readonly registry?: string;
```

The registry URL, if applicable.
