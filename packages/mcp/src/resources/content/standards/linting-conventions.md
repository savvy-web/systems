---
id: standards/linting-conventions
title: Linting and formatting
summary: Load when writing TypeScript or markdown that must pass Biome and markdownlint.
tier: standards
source: hand
tags: [lint]
priority: 0.8
related: [standards/test-classification]
---

## Rule

TypeScript is formatted and linted with Biome; markdown with markdownlint-cli2.
Both run in pre-commit through `@savvy-web/lint-staged` composable handlers, so
code that violates these rules does not commit.

## Why

A single shared config means contributors and agents follow the project's style
without being told it each session, and CI enforces the same rules locally and
remotely. The lint-staged plugin injects the active rules into Claude Code at
session start for exactly this reason.

## Examples

Biome enforcements that bite most often:

- `useImportExtensions` — relative imports MUST use `.js` extensions (ESM).
- `useImportType` — type-only imports use `import type { Foo }`, not `import { type Foo }`.
- `useNodejsImportProtocol` — Node built-ins use the `node:` protocol (`node:fs`).
- `useConsistentTypeDefinitions` — prefer interfaces.
- `noUnusedVariables` and `noImportCycles` are errors. Imports auto-sort.
- Test files relax `noUndeclaredDependencies`.

markdownlint rules that bite most often:

- No line-length limit (MD013 disabled).
- Duplicate headings allowed only among siblings (MD024).
- HTML restricted to `br`, `details`, `summary`, `img`, `sup`, `sub`.
- Code fences MUST carry a language identifier (MD040).
- Tables use compact style — single space around cell content (MD060).
- Files end with a single trailing newline (MD047).

## See also

Test file naming and discovery is at `silk://standards/test-classification`.
