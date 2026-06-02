---
id: packages/github-action-effects/api/class/commandrunnererror
title: "CommandRunnerError — github-action-effects class"
summary: "Error when a shell command fails or produces unexpected output."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# CommandRunnerError

Error when a shell command fails or produces unexpected output.

```ts
class CommandRunnerError extends CommandRunnerError_base<{
    readonly command: string;
    readonly args: ReadonlyArray<string>;
    readonly exitCode: number | undefined;
    readonly stderr: string | undefined;
    readonly stdout?: string | undefined;
    readonly reason: string;
}>
```

## Members

### args

```ts
readonly args: ReadonlyArray<string>;
```

The arguments passed to the command.

### command

```ts
readonly command: string;
```

The command that was executed.

### exitCode

```ts
readonly exitCode: number | undefined;
```

The exit code, if available.

### message

```ts
get message(): string;
```

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.

### stderr

```ts
readonly stderr: string | undefined;
```

Captured stderr output, if available.

### stdout

```ts
readonly stdout?: string | undefined;
```

Captured stdout output, if available. Carried alongside stderr because some CLIs (notably `npm`) emit progress, notices, and even error details on stdout; downstream errors can consult both.
