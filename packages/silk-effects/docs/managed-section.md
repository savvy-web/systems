# ManagedSection

Read, write, sync, and check tool-owned regions in user-editable files using
BEGIN/END markers.

**Platform layer:** FileSystem

**Since:** 0.2.0

## What It Does

Many tools need to own a section of a file while letting users edit the rest.
For example, a git hook file might have a tool-managed region that runs
lint-staged, surrounded by user-defined commands. `ManagedSection` provides a
service for managing these delimited sections with BEGIN/END markers, plus value
objects (`SectionDefinition`, `SectionBlock`) for defining sections and their
content.

## Table of Contents

- [Value Objects](#value-objects)
- [Service API](#service-api)
- [Layer](#layer)
- [Tagged Enums](#tagged-enums)
- [Section Markers](#section-markers)
- [Error Types](#error-types)
- [Usage](#usage)
- [Dependencies on Other Services](#dependencies-on-other-services)

## Value Objects

### SectionDefinition

Identity envelope for a managed section type. Separates section identity
(tool name + comment style) from section content.

```typescript
class SectionDefinition extends Schema.TaggedClass<SectionDefinition>()(
  "SectionDefinition",
  {
    toolName: Schema.String,
    commentStyle: Schema.optionalWith(CommentStyleSchema, { default: () => "#" }),
  },
) {}
```

**Construction:**

```typescript
const def = SectionDefinition.make({ toolName: "MY-TOOL" });
const def2 = SectionDefinition.make({ toolName: "MY-TOOL", commentStyle: "//" });
```

**Equality:** Compares on `toolName` + `commentStyle`.

**Instance methods:**

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `block(content)` | `(content: string) => SectionBlock` | Create a `SectionBlock` with this definition's identity |
| `generate(fn)` | `<C>(fn: (config: C) => string) => (config: C) => SectionBlock` | Create a typed factory that produces blocks from config |
| `generateEffect(fn)` | `<C, E, R>(fn: (config: C) => Effect<string, E, R>) => (config: C) => Effect<SectionBlock, E \| SectionValidationError, R>` | Effectful version of `generate` |
| `diff(that)` | `(that: SectionDefinition) => SectionDiff` | Compare two definitions |
| `beginMarker` | `get => string` | The BEGIN marker string |
| `endMarker` | `get => string` | The END marker string |

**Static methods (dual API):**

| Method | Description |
| ------ | ----------- |
| `SectionDefinition.generate(self, fn)` or `SectionDefinition.generate(fn)(self)` | Data-first or data-last |
| `SectionDefinition.generateEffect(self, fn)` or `SectionDefinition.generateEffect(fn)(self)` | Data-first or data-last |
| `SectionDefinition.withValidation(self, fn)` or `SectionDefinition.withValidation(fn)(self)` | Attach a validation predicate |
| `SectionDefinition.diff(self, that)` or `SectionDefinition.diff(that)(self)` | Data-first or data-last |

**Validation:**

```typescript
const validated = SectionDefinition.withValidation(def, (block) =>
  block.content.includes("lint-staged"),
);
// validated.block("npx lint-staged")  -- OK
// validated.block("echo hi")          -- throws SectionValidationError
```

### ShellSectionDefinition

Convenience variant for shell hooks. `commentStyle` is always `"#"` and not
configurable.

```typescript
class ShellSectionDefinition extends Schema.TaggedClass<ShellSectionDefinition>()(
  "ShellSectionDefinition",
  { toolName: Schema.String },
) {}
```

Has the same `block()`, `generate()`, `generateEffect()`, `beginMarker`, and
`endMarker` API as `SectionDefinition`.

### SectionBlock

The content between managed section markers.

```typescript
class SectionBlock extends Schema.TaggedClass<SectionBlock>()(
  "SectionBlock",
  {
    toolName: Schema.String,
    commentStyle: CommentStyleSchema,
    content: Schema.String,
  },
) {}
```

**Equality:** Compares on normalized content only (trimmed, whitespace-collapsed).
Two blocks with different raw whitespace but the same trimmed content are equal.

**Instance properties:**

| Property | Type | Description |
| -------- | ---- | ----------- |
| `text` | `string` | Raw content (alias for `content`) |
| `normalized` | `string` | Trimmed, whitespace-collapsed content |
| `rendered` | `string` | Full text including BEGIN/END markers |

**Instance methods:**

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `prepend(lines)` | `(lines: string) => SectionBlock` | Return new block with lines prepended |
| `append(lines)` | `(lines: string) => SectionBlock` | Return new block with lines appended |
| `diff(that)` | `(that: SectionBlock) => SectionDiff` | Line-level diff against another block |

**Static methods (dual API):**

| Method | Description |
| ------ | ----------- |
| `SectionBlock.diff(self, that)` or `SectionBlock.diff(that)(self)` | Data-first or data-last |
| `SectionBlock.prepend(self, lines)` or `SectionBlock.prepend(lines)(self)` | Data-first or data-last |
| `SectionBlock.append(self, lines)` or `SectionBlock.append(lines)(self)` | Data-first or data-last |

### CommentStyle

```typescript
type CommentStyle = "#" | "//";
```

- `"#"` -- Shell/YAML style, for hook scripts and `.env` files
- `"//"` -- C-style, for JavaScript/TypeScript files

## Service API

```typescript
class ManagedSection extends Context.Tag("@savvy-web/silk-effects/ManagedSection")<
  ManagedSection,
  {
    readonly read: {
      (definition: SectionDefinition): (path: string) => Effect<SectionBlock | null, SectionParseError>;
      (path: string, definition: SectionDefinition): Effect<SectionBlock | null, SectionParseError>;
    };

    readonly isManaged: {
      (definition: SectionDefinition): (path: string) => Effect<boolean>;
      (path: string, definition: SectionDefinition): Effect<boolean>;
    };

    readonly write: {
      (block: SectionBlock): (path: string) => Effect<void, SectionWriteError>;
      (path: string, block: SectionBlock): Effect<void, SectionWriteError>;
    };

    readonly sync: {
      (block: SectionBlock): (path: string) => Effect<SyncResult, SectionWriteError>;
      (path: string, block: SectionBlock): Effect<SyncResult, SectionWriteError>;
    };

    readonly check: {
      (block: SectionBlock): (path: string) => Effect<CheckResult, SectionParseError>;
      (path: string, block: SectionBlock): Effect<CheckResult, SectionParseError>;
    };
  }
>() {}
```

All methods support **dual API** (data-first and data-last). Identity-only
operations (`read`, `isManaged`) accept a `SectionDefinition`. Content
operations (`write`, `sync`, `check`) accept a `SectionBlock`.

### `read(path, definition)` / `read(definition)(path)`

Read the managed section from a file.

- Returns `SectionBlock | null` -- `null` if the file does not exist or contains no markers.
- Fails with `SectionParseError` on I/O errors.

### `isManaged(path, definition)` / `isManaged(definition)(path)`

Check whether a file contains markers for the given definition.

- Returns `boolean`. Always succeeds.

### `write(path, block)` / `write(block)(path)`

Write the managed section to a file.

- If the file exists and contains markers: replaces the managed content between markers.
- If the file exists but has no markers: appends the section at the end.
- If the file does not exist: creates it with just the section.
- Preserves all content outside the markers.
- Fails with `SectionWriteError` on I/O errors.

### `sync(path, block)` / `sync(block)(path)`

Smart write that reports what changed.

- Reads the current section, compares with the provided block, writes only if different.
- Returns `SyncResult`: `Created()`, `Updated({ diff })`, or `Unchanged()`.
- Fails with `SectionWriteError` on I/O errors.

### `check(path, block)` / `check(block)(path)`

Read-only comparison without writing.

- Returns `CheckResult`: `Found({ isUpToDate, diff })` or `NotFound()`.
- Fails with `SectionParseError` on I/O errors.

## Layer

```typescript
export const ManagedSectionLive: Layer.Layer<
  ManagedSection,
  never,
  FileSystem.FileSystem
>;
```

Requires `FileSystem` from `@effect/platform`.

## Tagged Enums

### SyncResult

```typescript
type SyncResult = Data.TaggedEnum<{
  Created: {};
  Updated: { diff: SectionDiff };
  Unchanged: {};
}>;
```

### CheckResult

```typescript
type CheckResult = Data.TaggedEnum<{
  Found: { isUpToDate: boolean; diff: SectionDiff };
  NotFound: {};
}>;
```

### SectionDiff

```typescript
type SectionDiff = Data.TaggedEnum<{
  Unchanged: {};
  Changed: { added: ReadonlyArray<string>; removed: ReadonlyArray<string> };
}>;
```

## Section Markers

The marker format used in files:

```text
# --- BEGIN MY-TOOL MANAGED SECTION ---
managed content here
# --- END MY-TOOL MANAGED SECTION ---
```

With `//` comment style:

```text
// --- BEGIN MY-TOOL MANAGED SECTION ---
managed content here
// --- END MY-TOOL MANAGED SECTION ---
```

The tool name is uppercased in the markers. User content outside the markers is
preserved on write operations.

## Error Types

### SectionParseError

Raised when a managed section cannot be parsed from a file.

```typescript
class SectionParseError extends Data.TaggedError("SectionParseError")<{
  readonly path: string;
  readonly reason: string;
}> {}
```

### SectionWriteError

Raised when a managed section cannot be written to a file.

```typescript
class SectionWriteError extends Data.TaggedError("SectionWriteError")<{
  readonly path: string;
  readonly reason: string;
}> {}
```

### SectionValidationError

Raised when a `SectionBlock` fails validation at creation time (when using
`SectionDefinition.withValidation`).

```typescript
class SectionValidationError extends Data.TaggedError("SectionValidationError")<{
  readonly toolName: string;
  readonly reason: string;
}> {}
```

## Usage

### Basic read/write

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ManagedSection,
  ManagedSectionLive,
  SectionDefinition,
} from "@savvy-web/silk-effects";

const def = SectionDefinition.make({ toolName: "LINT-STAGED" });

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;

  // Create a block and write it
  const block = def.block("\nnpx lint-staged\n");
  yield* ms.write(".husky/pre-commit", block);

  // Read it back
  const existing = yield* ms.read(".husky/pre-commit", def);
  // existing => SectionBlock | null
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

### Sync with change detection

```typescript
const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  const block = def.block("\nnpx lint-staged\n");

  const result = yield* ms.sync(".husky/pre-commit", block);

  if (result._tag === "Created") {
    console.log("Section created");
  } else if (result._tag === "Updated") {
    console.log("Section updated", result.diff);
  } else {
    console.log("No changes needed");
  }
});
```

### Typed factory with generate

```typescript
interface HookConfig {
  commands: string[];
}

const def = SectionDefinition.make({ toolName: "GIT-HOOKS" });

const generateHook = def.generate<HookConfig>((config) =>
  "\n" + config.commands.join("\n") + "\n"
);

const block = generateHook({ commands: ["npx lint-staged", "pnpm typecheck"] });
// block.rendered =>
// # --- BEGIN GIT-HOOKS MANAGED SECTION ---
// npx lint-staged
// pnpm typecheck
// # --- END GIT-HOOKS MANAGED SECTION ---
```

### Data-last (pipeable) API

```typescript
const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  const block = def.block("\nnpx lint-staged\n");

  // Data-last: create a function, then apply it
  const syncFile = ms.sync(block);
  const result = yield* syncFile(".husky/pre-commit");
});
```

## Dependencies on Other Services

None beyond `FileSystem` from the platform layer.
