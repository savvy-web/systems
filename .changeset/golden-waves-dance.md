---
"@savvy-web/silk-effects": minor
---

## Features

### SectionDefinition and SectionBlock value objects

Introduces `SectionDefinition` and `ShellSectionDefinition` as `Schema.TaggedClass` value objects that declare the identity of a managed section type. `SectionDefinition` compares on `toolName` + `commentStyle` via `Equal`/`Hash`. `ShellSectionDefinition` is a convenience subtype that hardcodes `commentStyle` to `"#"`.

`SectionBlock` is the complementary value object holding the content between a pair of managed section markers. Equality is normalized (trimmed, whitespace-collapsed), so cosmetic whitespace differences do not produce spurious diffs.

Both classes expose a dual API (`Fn.dual`) so methods can be used data-first or data-last in a pipeline:

```typescript
import { SectionDefinition, SectionBlock } from "@savvy-web/silk-effects";

const def = new SectionDefinition({ toolName: "silk", commentStyle: "#" });

// Data-first
const block = def.block("\nexport FOO=bar\n");

// Dual static — data-last for pipe composition
const withValidation = SectionDefinition.withValidation(
  (block) => block.content.includes("FOO"),
)(def);
```

### SectionDiff, SyncResult, and CheckResult tagged enums

Three `Data.TaggedEnum` types capture the outcomes of section operations:

- `SectionDiff` — `Unchanged` or `Changed({ added, removed })` from comparing two `SectionBlock` values
- `SyncResult` — `Created`, `Updated({ diff })`, or `Unchanged` from a write-if-changed operation
- `CheckResult` — `Found({ isUpToDate, diff })` or `NotFound` from a read-only comparison

### ManagedSection service redesigned with sync/check/dual API

`ManagedSection` is a fully redesigned `Context.Tag` service backed by `@effect/platform` `FileSystem`. The previous hook-style API is replaced with five operations, all using the dual pattern:

| Method | Takes | Returns |
| :--- | :--- | :--- |
| `read` | `SectionDefinition` | `SectionBlock \| null` |
| `isManaged` | `SectionDefinition` | `boolean` |
| `write` | `SectionBlock` | `void` |
| `sync` | `SectionBlock` | `SyncResult` |
| `check` | `SectionBlock` | `CheckResult` |

`sync` writes only when content has changed and returns a typed result describing what happened. `check` is read-only and reports staleness without writing.

```typescript
import { ManagedSection, ManagedSectionLive, SectionBlock } from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";

const block = SectionBlock.make({ toolName: "silk", commentStyle: "#", content: "\nexport FOO=bar\n" });

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  const result = yield* ms.sync(".env.local", block);
  // result is SyncResult.Created | SyncResult.Updated | SyncResult.Unchanged
});

Effect.runPromise(
  program.pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  )
);
```

### ToolDiscovery service

New `ToolDiscovery` `Context.Tag` service that locates CLI tools globally (PATH) or locally (via the detected package manager), extracts versions, enforces source and version constraints, and caches results by tool name.

Three resolution methods:

- `resolve(definition)` — returns `ResolvedTool` or `ToolResolutionError`
- `require(definition, message?)` — like `resolve` but maps failures to `ToolNotFoundError`
- `isAvailable(definition)` — quick boolean availability check, no caching

Resolution behavior is controlled by three tagged-enum policies on `ToolDefinition`:

- `VersionExtractor` — `Flag({ flag, parse? })`, `Json({ flag, path })`, or `None`
- `ResolutionPolicy` — `Report`, `PreferLocal`, `PreferGlobal`, or `RequireMatch`
- `SourceRequirement` — `Any`, `OnlyLocal`, `OnlyGlobal`, or `Both`

```typescript
import { ToolDiscovery, ToolDiscoveryLive, ToolDefinition, ResolutionPolicy } from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";

const biome = ToolDefinition.make({
  name: "biome",
  policy: ResolutionPolicy.PreferLocal(),
});

const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;
  const tool = yield* td.require(biome);
  // tool.exec("check", "--write") returns a ToolCommand
  return yield* tool.exec("check", "--write").string();
}).pipe(
  Effect.provide(ToolDiscoveryLive),
  Effect.provide(NodeContext.layer),
);
```

### ResolvedTool and ToolCommand

`ResolvedTool` is the `Schema.TaggedClass` value returned by `ToolDiscovery`. It carries the resolved source, versions, and package manager, and exposes two command-building methods:

- `exec(...args)` — runs the tool through the local package manager (`pnpm exec`, `npx --no`, etc.) or directly if global
- `dlx(...args)` — runs the tool via the package manager's dlx/npx equivalent without requiring a local install

Both return a `ToolCommand`, a thin wrapper around `@effect/platform` `Command` with instance-method ergonomics (`cmd.string()`, `cmd.lines()`, `cmd.exitCode()`, `cmd.stream()`, `cmd.env()`, `cmd.workingDirectory()`, `cmd.stdin()`).

### Module restructure — single root export, role-based layout

The sub-path exports (`/biome`, `/config`, `/hooks`, `/publish`, `/tags`, `/versioning`) have been removed. All public APIs are now available from the single root import:

```typescript
// Before (v0.1.x)
import { ManagedSection } from "@savvy-web/silk-effects/hooks";
import { TagStrategy } from "@savvy-web/silk-effects/tags";

// After (v0.2.0+)
import { ManagedSection, TagStrategy } from "@savvy-web/silk-effects";
```

Source files are reorganized into four role-based folders: `errors/`, `schemas/`, `services/`, and `utils/`. Unit tests are co-located with their source file.
