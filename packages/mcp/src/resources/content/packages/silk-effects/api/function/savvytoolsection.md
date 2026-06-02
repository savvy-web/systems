---
id: packages/silk-effects/api/function/savvytoolsection
title: "savvyToolSection — silk-effects function"
summary: "Build a consumer's one-line tool section so every consumer calls the shared base helpers identically."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# savvyToolSection

Build a consumer's one-line tool section so every consumer calls the shared base helpers identically.

```ts
function savvyToolSection(toolName: string, command: string): SectionBlock;
```

## Parameters

- `toolName` `string` — Section identity; also drives the marker names (uppercased).
- `command` `string` — The command passed verbatim to `pm_exec`, run only outside CI.

## Returns

A shell [SectionBlock](silk://packages/silk-effects/api/class/sectionblock) (`commentStyle: "#"`) for `toolName`.

## Examples

```ts
yield* ManagedSection.syncMany(".husky/commit-msg", [
  SavvyBaseSection.block(savvyBasePreamble()),
  savvyToolSection("savvy-commit", 'commitlint --config "$ROOT/lib/configs/commitlint.config.ts" --edit "$1"'),
]);

```
