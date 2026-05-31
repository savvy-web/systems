---
"@savvy-web/silk": minor
---

## Features

### Single install target for Silk Suite dev tooling

`@savvy-web/silk` is the unified install package for the Silk Suite. It replaces the previous pattern of installing `@savvy-web/changesets`, `@savvy-web/commitlint`, and `@savvy-web/lint-staged` separately. Config-integration shims re-export the relevant `@savvy-web/silk-effects` logic at drop-in entry points compatible with each toolchain's require/import resolution.

Exported entry points:

- `@savvy-web/silk/changesets` — changeset formatter (default export: `{ getReleaseLine, getDependencyReleaseLine }`)
- `@savvy-web/silk/changesets/changelog` — changelog formatter re-export
- `@savvy-web/silk/changesets/markdownlint` — markdownlint custom rules for changeset validation
- `@savvy-web/silk/changesets/remark` — remark plugins for changelog post-processing
- `@savvy-web/silk/commitlint` — commitlint config factory
- `@savvy-web/silk/commitlint/static` — static commitlint config
- `@savvy-web/silk/commitlint/prompt` — commitizen prompt configuration
- `@savvy-web/silk/commitlint/formatter` — custom commitlint output formatter
- `@savvy-web/silk/lint` — lint-staged configuration factory
- `@savvy-web/silk/biome` — Biome preset JSON asset

```typescript
// commitlint.config.ts
export { default } from "@savvy-web/silk/commitlint";

// .markdownlint-cli2.jsonc
{ "customRules": ["@savvy-web/silk/changesets/markdownlint"] }

// .changeset/config.json
{ "changelog": "@savvy-web/silk/changesets/changelog" }
```

### MCP server integration

The bundled `silk@savvy-web-systems` Claude Code plugin now ships an MCP server entry point. A `start-mcp.sh` launcher wires the plugin into Claude Code's MCP layer, and a new `mcp-orientation` session-start hook surfaces relevant context at the start of each session.
