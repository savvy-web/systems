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

The bundled `silk@savvy-web-systems` Claude Code plugin now ships an MCP server entry point. A `start-mcp.sh` launcher wires the plugin into Claude Code's MCP layer, and an `mcp-orientation` session-start hook surfaces relevant context at the start of each session.

### Catalog-first MCP orientation and docs-search skill

The bundled silk Claude Code plugin now steers sessions toward the shared savvy MCP corpus more firmly. The SessionStart orientation hook is strengthened so the agent searches `silk://catalog` and the `silk_docs_search` tool before guessing, reading source, or running grep, and reserves shell workspace commands for git state and cases the `workspace_info` tool does not cover.

A new on-demand docs-search skill documents how to query the corpus well: start at `silk://catalog`, search by concept rather than filename, scope by tier, and read ranked results instead of enumerating the whole corpus. The agent loads it when it needs query technique without paying for it in every session's base context.

### Unified SessionStart hooks and a dogfood-feedback prompt

The plugin's SessionStart hooks are consolidated into two — an always-on `orientation.sh` that persists the session environment and emits the combined orientation, and a `startup-only.sh` that runs the per-session `savvy commit` setup and startup orientation. The session environment variables and the push-guard bypass now use the `SILK_` namespace; set `SILK_SKIP_PUSH_CHECK=1` on a `git push` to bypass the changeset push guard.

Because this is an early release, the orientation now asks the agent to note any rough edges it hits — wrong, unhelpful, or confusing results from a skill, hook, the `savvy` CLI, or an agent — and to surface them at the end of a session. With your explicit agreement, the agent can open an issue in `savvy-web/systems`; it will never file one on its own.
