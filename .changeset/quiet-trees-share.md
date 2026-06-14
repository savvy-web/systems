---
"@savvy-web/silk": minor
---

## Features

### Shipped TSConfig presets

`@savvy-web/silk` now ships two ready-to-use TSConfig presets under the `tsconfig/` export namespace, for projects that follow Silk conventions but do not depend on a Silk build tool at the relevant package:

- `@savvy-web/silk/tsconfig/node/root.json` — a monorepo root that runs under Node.js (`module: nodenext`, `target: es2025`, composite/declaration, `types: ["node"]`). Use it where `@savvy-web/bundler` is not a dependency of the root `package.json`.
- `@savvy-web/silk/tsconfig/rspress/website.json` — a standard RSPress site, aligned with RSPress's official website config (`module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit`, `isolatedModules`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noUnusedLocals`/`noUnusedParameters`, `mdx.checkMdx`, `lib: ["dom", "es2023"]`, react/react-dom types), targeting the browser rather than Node.

Reference either from a package's `tsconfig.json` via `"extends": "@savvy-web/silk/tsconfig/node/root.json"`.

## Build System

The shipped Biome config (`@savvy-web/silk/biome`) now:

- Excludes `.claude/worktrees` from linting, so nested Claude Code worktrees that carry their own root config no longer trigger Biome's nested-root abort and break the pre-commit hook. Every consumer inherits this automatically rather than re-discovering it.
- Broadens the test-fixtures exclusion to `**/__test__/**/fixtures` (any nesting depth).
- Formats shipped TSConfig presets under `**/public/tsconfig/**/*.json` with the standard tsconfig key-sorting rules.
