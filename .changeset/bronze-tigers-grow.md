---
"@savvy-web/silk-effects": minor
---

## Features

### Changesets namespace

Adds a `Changesets` namespace export with the full changeset tooling logic extracted from the standalone `@savvy-web/changesets` package. Consumers can import changeset validation, changelog generation, dependency-table utilities, remark pipeline plugins, markdownlint custom rules, and Effect-based services (`ConfigInspector`, `BranchAnalyzer`, `ChangelogService`) directly from `@savvy-web/silk-effects`.

```typescript
import { Changesets } from "@savvy-web/silk-effects";

// Changelog formatter
const { getReleaseLine, getDependencyReleaseLine } = Changesets.Changelog;

// Linter API
const result = await Changesets.Linter.lint(changesetContent);

// Remark pipeline presets
const output = await Changesets.Remark.transform(markdown);
```

### Commitlint namespace

Adds a `Commitlint` namespace export carrying the hook, formatter, config factory, prompt configuration, and detection utilities that back the Silk commitlint integration. Includes the Claude Code hook diagnostics (branch, DCO, open-issues, signing), the custom rules engine, and the silent-logger shim.

```typescript
import { Commitlint } from "@savvy-web/silk-effects";

// Config factory
const config = Commitlint.Config.factory({ scopes: ["feat", "fix"] });

// Formatter
const formatted = Commitlint.Formatter.format(results);
```

### Lint namespace

Adds a `Lint` namespace export with workspace-aware Biome, Markdown, TypeScript, YAML, and shell-script lint handler logic, plus the `createConfig` preset builder and workspace-discovery utilities.

```typescript
import { Lint } from "@savvy-web/silk-effects";

// Create a lint preset config
const config = Lint.Config.createConfig({ preset: "strict" });
```

### Dual-format build

The package now ships both ESM and CJS bundles. The CJS build allows tools with CommonJS loaders — such as `markdownlint-cli2`'s custom-rule loader — to `require()` the markdownlint rules directly from `@savvy-web/silk-effects`.
