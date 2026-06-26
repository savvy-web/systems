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
  readonly command: string; /** The arguments passed to the command. */
  readonly args: ReadonlyArray<string>; /** The exit code, if available. */
  readonly exitCode: number | undefined; /** Captured stderr output, if available. */
  readonly stderr: string | undefined;
  readonly stdout?: string | undefined; /** Human-readable description of what went wrong. */
  readonly reason: string;
}>
```

## Members

### args

```ts
readonly args: ReadonlyArray<string>;
```

### command

```ts
readonly command: string;
```

The command that was executed.

### exitCode

```ts
readonly exitCode: number | undefined;
```

### message

```ts
get message(): string;
```

### reason

```ts
readonly reason: string;
```

### stderr

```ts
readonly stderr: string | undefined;
```

### stdout

```ts
readonly stdout?: string | undefined;
```

Captured stdout output, if available. Carried alongside stderr because some CLIs (notably `npm`) emit progress, notices, and even error details on stdout; downstream errors can consult both.
