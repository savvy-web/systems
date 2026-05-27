---
"@savvy-web/silk-effects": minor
---

## Features

### `ManagedSection.syncMany` — ordered multi-section sync

`ManagedSection.syncMany(path, blocks)` (and its data-last form `syncMany(blocks)(path)`) accepts an ordered array of `SectionBlock` descriptors and ensures every section exists with its given content in declared relative order. Existing sections are updated in place; missing sections are inserted adjacent to their declared sibling. Section order is normalized on each call, user content and unrelated tool sections are preserved, and the operation is idempotent. Returns one `SyncResult` (`Created` / `Updated` / `Unchanged`) per input block, in input order.

```typescript
import { Effect } from "effect";
import {
  ManagedSection,
  SavvyBaseSection,
  savvyBasePreamble,
  savvyToolSection,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const sections = yield* ManagedSection;
  return yield* sections.syncMany(".husky/pre-commit", [
    SavvyBaseSection.block(savvyBasePreamble()),
    savvyToolSection("savvy-lint", 'lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"'),
  ]);
});
// result: [SyncResult.Created, SyncResult.Created]
```

### `ManagedSection.remove` — section removal

`ManagedSection.remove(path, definition)` (and its data-last form `remove(definition)(path)`) removes a managed section's full marker span from the file and collapses the leftover blank line. Returns `true` when a section was removed, `false` when the section is absent or the file does not exist. Useful for migrating renamed sections.

```typescript
const program = Effect.gen(function* () {
  const sections = yield* ManagedSection;
  return yield* sections.remove(".husky/pre-commit", OldSection);
});
// result: true (a section was removed) | false (absent or file missing)
```

### `SavvySections` — shared husky-hook shell helpers

New helpers, exported from the package root, provide composable primitives for building multi-section husky hooks:

- `SavvyBaseSection` + `savvyBasePreamble()` — a package-manager detection preamble that sets `ROOT`, `in_ci`, `PM`, and `pm_exec` shell variables.
- `SavvyHooksSection` + `savvyHooksHygiene()` — a self-guarded repo hygiene section (runs only outside CI).
- `savvyToolSection(toolName, command)` — builds an `in_ci || pm_exec <command>` tool-execution section for any named tool.

Together these let consumer CLIs compose multiple ordered managed sections per hook file and migrate renamed sections cleanly.

```typescript
import {
  SavvyBaseSection,
  savvyBasePreamble,
  savvyToolSection,
} from "@savvy-web/silk-effects";

// savvyToolSection needs a savvy-base section ahead of it in the same hook so
// `in_ci` / `pm_exec` are defined — pass both to syncMany in order.
const blocks = [
  SavvyBaseSection.block(savvyBasePreamble()),
  savvyToolSection("savvy-lint", 'lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"'),
];
```
