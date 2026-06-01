---
id: packages/silk-effects/managed-section
title: ManagedSection
summary: Load when reading, writing, or syncing tool-owned BEGIN/END regions in user-editable files.
tier: packages
source: hand
tags: [managed-section, effect]
priority: 0.5
related: [packages/silk-effects/, packages/silk-effects/platform-layers]
---

## What

`ManagedSection` lets a tool own a delimited region of a file while leaving the
rest user-editable, using BEGIN/END markers. The motivating case is a husky hook
that runs a tool's command inside a managed region surrounded by user commands.
The service ships with value objects — `SectionDefinition` (section identity:
tool name + comment style) and `SectionBlock` (the content between markers).
Platform layer: `FileSystem`. Since 0.2.0.

## API

`SectionDefinition` and `SectionBlock` are `Schema.TaggedClass` value objects with
structural equality — `SectionBlock` compares on normalized (trimmed,
whitespace-collapsed) content, so whitespace-only differences are equal. Comment
style is `"#"` (shell/YAML) or `"//"` (C-style); the tool name is uppercased into
the markers. `SectionDefinition.block(content)` mints a block;
`.generate(fn)` / `.generateEffect(fn)` build typed factories; `.withValidation`
attaches a content predicate that throws `SectionValidationError`.

The service Tag exposes (all dual-API, data-first or data-last):

- `read(path, def)` → `SectionBlock | null` (null if no file or no markers).
- `isManaged(path, def)` → `boolean` (always succeeds).
- `write(path, block)` → replaces the managed region, appends if markerless,
  creates the file if absent; preserves content outside the markers.
- `sync(path, block)` → smart write reporting `SyncResult`: `Created`,
  `Updated({ diff })`, or `Unchanged`; writes only when different.
- `syncMany(path, blocks)` → syncs several ordered sections in one file
  idempotently, inserting missing siblings and normalizing drift; returns one
  `SyncResult` per block in input order.
- `check(path, block)` → read-only `CheckResult`: `Found({ isUpToDate, diff })`
  or `NotFound`.
- `remove(path, def)` → deletes the span including markers and collapses the
  leftover blank line; `true` if removed, `false` if absent (missing file → false).

Identity-only operations (`read`, `isManaged`, `remove`) take a `SectionDefinition`;
content operations take a `SectionBlock`. Errors: `SectionParseError`,
`SectionWriteError`, `SectionValidationError`.

## Layer

```typescript
export const ManagedSectionLive: Layer.Layer<ManagedSection, never, FileSystem.FileSystem>;
```

## Usage

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ManagedSection, ManagedSectionLive, SectionDefinition } from "@savvy-web/silk-effects";

const def = SectionDefinition.make({ toolName: "LINT-STAGED" });

await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    const result = yield* ms.sync(".husky/pre-commit", def.block("\nnpx lint-staged\n"));
    // result._tag => "Created" | "Updated" | "Unchanged"
  }).pipe(Effect.provide(ManagedSectionLive), Effect.provide(NodeContext.layer)),
);
```

The `SavvySections` helpers (since 0.5.0) provide ready-made husky-hook shells:
`SavvyBaseSection` + `savvyBasePreamble()` define a shared package-manager preamble
(`ROOT`, the `in_ci` predicate, `PM`, `pm_exec`), and `savvyToolSection(toolName,
command)` builds a consumer's one-line tool section. Pass the base first to
`syncMany` so `in_ci` and `pm_exec` are defined before a tool section uses them.

## Related

Overview: `silk://packages/silk-effects/`. Layer wiring:
`silk://packages/silk-effects/platform-layers`.
