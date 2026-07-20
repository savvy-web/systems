---
"@savvy-web/silk-effects": minor
---

## Features

Added `Lint.PnpmWorkspace.formatContent(content, filepath?)` — a public static that stringifies sorted `pnpm-workspace.yaml` content and normalizes it through Prettier's YAML printer to the repo's canonical byte format (2-space block-sequence indent, double-quoted scalars).

`Lint` handlers have two entry points that must never drift from each other: the lint-staged `create()` handler and the `savvy lint fmt <name>` CLI subcommand. `formatContent` is now the single source of truth both call, so the two paths always produce identical bytes for the same file.

```typescript
import { Lint } from "@savvy-web/silk-effects";

const formatted = await Lint.PnpmWorkspace.formatContent(sortedContent, "pnpm-workspace.yaml");
```
