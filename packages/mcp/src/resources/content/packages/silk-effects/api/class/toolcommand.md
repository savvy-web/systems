---
id: packages/silk-effects/api/class/toolcommand
title: "ToolCommand — silk-effects class"
summary: "Wraps `@effect/platform` Command with instance method ergonomics. Use `yield* cmd.string()` instead of `yield* Command.string(cmd)`."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ToolCommand

Wraps `@effect/platform` Command with instance method ergonomics. Use `yield* cmd.string()` instead of `yield* Command.string(cmd)`.

```ts
class ToolCommand
```

## Members

### (constructor)

```ts
constructor(command: Command.Command);
```

Constructs a new instance of the `ToolCommand` class

### command

```ts
readonly command: Command.Command;
```

### env

```ts
env(environment: Record<string, string | undefined>): ToolCommand;
```

### exitCode

```ts
exitCode(): Effect.Effect<number, PlatformError, CommandExecutor.CommandExecutor>;
```

### lines

```ts
lines(encoding?: string): Effect.Effect<Array<string>, PlatformError, CommandExecutor.CommandExecutor>;
```

### stdin

```ts
stdin(input: string): ToolCommand;
```

### stream

```ts
stream(): Stream.Stream<Uint8Array, PlatformError, CommandExecutor.CommandExecutor>;
```

### string

```ts
string(encoding?: string): Effect.Effect<string, PlatformError, CommandExecutor.CommandExecutor>;
```

### workingDirectory

```ts
workingDirectory(cwd: string): ToolCommand;
```
