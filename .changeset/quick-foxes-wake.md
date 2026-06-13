---
"@savvy-web/mcp": minor
---

## Features

### changeset_validate tool

A new `changeset_validate` MCP tool validates changeset files against the section-aware lint rules (CSH001–CSH005). It accepts an optional `dir` path (defaults to `.changeset/`) and returns a structured result with a pass/fail flag, an error count, and per-file diagnostics including file path, rule ID, line, column, and message.

```json
{
  "tool": "changeset_validate",
  "arguments": { "dir": ".changeset" }
}
```

Returns `{ dir, ok, errorCount, messages[] }` where each message has `file`, `rule`, `line`, `column`, and `message` fields.

### classify mode for changeset_inspect

`changeset_inspect` now accepts `mode: "classify"` alongside the existing `branch` and `config` modes. Pass an array of repo-relative file paths and receive the owning package for each, resolved against the workspace configuration.

```json
{
  "tool": "changeset_inspect",
  "arguments": { "mode": "classify", "paths": ["packages/cli/src/index.ts"] }
}
```
