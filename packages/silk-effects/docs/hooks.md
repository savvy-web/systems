# Hooks Module

[Back to README](../README.md)

Managed section pattern for tool-owned regions in user-editable files.

```typescript
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects/hooks";
```

## Table of Contents

- [Overview](#overview)
- [Service](#service)
- [Marker Format](#marker-format)
- [Schemas](#schemas)
- [Errors](#errors)
- [Examples](#examples)

## Overview

The hooks module provides a managed section pattern that lets tools own a region of a file without overwriting user content. Each managed section is bounded by BEGIN/END marker comments that embed the tool name, so multiple tools can maintain independent sections in the same file.

Common use case: managing git hook scripts (e.g., `.husky/pre-commit`) where both automated tooling and developers need to add commands.

This module requires a platform layer (FileSystem).

## Service

### ManagedSection

```typescript
class ManagedSection {
  readonly read: (
    path: string,
    toolName: string,
    commentStyle?: string,
  ) => Effect.Effect<ManagedSectionResult | null, ManagedSectionParseError>;

  readonly write: (
    path: string,
    toolName: string,
    content: string,
    commentStyle?: string,
  ) => Effect.Effect<void, ManagedSectionWriteError>;

  readonly update: (
    path: string,
    toolName: string,
    content: string,
    commentStyle?: string,
  ) => Effect.Effect<void, ManagedSectionWriteError>;

  readonly isManaged: (
    path: string,
    toolName: string,
    commentStyle?: string,
  ) => Effect.Effect<boolean>;
}
```

**Layer:** `ManagedSectionLive` -- requires `FileSystem` from `@effect/platform`.

#### read

Parse a managed section from a file. Returns `null` when the file does not exist or contains no markers for the given tool.

#### write

Write managed content to a file. Behavior depends on the current state:

- File has existing markers -- replaces the managed section, preserves surrounding content.
- File exists but has no markers -- appends a new managed section.
- File does not exist -- creates the file with only the managed section.

#### update

Convenience method that delegates to `write`. Replaces managed content while preserving surrounding user content.

#### isManaged

Returns `true` when the file contains both BEGIN and END markers for the given tool.

## Marker Format

Markers use the following pattern:

```text
# --- BEGIN SILK MANAGED SECTION ---
managed content here
# --- END SILK MANAGED SECTION ---
```

The tool name is uppercased in the markers. Two comment styles are supported:

| Style | Prefix | Use Case |
| ----- | ------ | -------- |
| Shell | `#` (default) | Hook scripts, YAML, `.env` files |
| C-style | `//` | JavaScript, TypeScript files |

Example with `//` comment style:

```text
// --- BEGIN MY_TOOL MANAGED SECTION ---
managed content here
// --- END MY_TOOL MANAGED SECTION ---
```

Multiple tools can coexist in the same file because each tool's markers include its name.

## Schemas

### ManagedSectionResult

Parsed result of reading a managed section:

```typescript
type ManagedSectionResult = {
  before: string;   // content before the BEGIN marker
  managed: string;  // content between BEGIN and END markers
  after: string;    // content after the END marker
};
```

### CommentStyle

```typescript
type CommentStyle = "#" | "//";
```

## Errors

### ManagedSectionParseError

Raised when a managed section cannot be parsed. Contains `path` and `reason`. Typically caused by filesystem permission errors.

### ManagedSectionWriteError

Raised when a managed section cannot be written. Contains `path` and `reason`. Triggered by read failures during content replacement or write failures.

## Examples

### Write a managed section

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects/hooks";

await Effect.runPromise(
  Effect.gen(function* () {
    const section = yield* ManagedSection;
    yield* section.write(".husky/pre-commit", "silk", "\nnpx lint-staged\n");
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

The resulting file:

```text
# --- BEGIN SILK MANAGED SECTION ---

npx lint-staged

# --- END SILK MANAGED SECTION ---
```

### Read a managed section

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects/hooks";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const section = yield* ManagedSection;
    return yield* section.read(".husky/pre-commit", "silk");
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);

if (result !== null) {
  console.log("Managed content:", result.managed);
  console.log("User content before:", result.before);
  console.log("User content after:", result.after);
}
```

### Update managed content

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects/hooks";

await Effect.runPromise(
  Effect.gen(function* () {
    const section = yield* ManagedSection;
    yield* section.update(
      ".husky/pre-commit",
      "silk",
      "\nnpx lint-staged\npnpm typecheck\n",
    );
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

### Check if a file is managed

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects/hooks";

const managed = await Effect.runPromise(
  Effect.gen(function* () {
    const section = yield* ManagedSection;
    return yield* section.isManaged(".husky/pre-commit", "silk");
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
// true or false
```

### Use C-style comments for TypeScript files

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects/hooks";

await Effect.runPromise(
  Effect.gen(function* () {
    const section = yield* ManagedSection;
    yield* section.write(
      "src/generated.ts",
      "codegen",
      "\nexport const VERSION = '1.0.0';\n",
      "//",
    );
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```
