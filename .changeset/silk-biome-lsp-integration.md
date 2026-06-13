---
"@savvy-web/silk": minor
---

## Features

The silk plugin now integrates Biome two ways. A Biome language server (`biome lsp-proxy`, launched through a global-first resolver that falls back to a project-local install) surfaces lint and format diagnostics automatically after edits across JavaScript, TypeScript, JSON, CSS, and GraphQL files. A new `PreToolUse` hook nudges toward the `biome_check` MCP tool whenever Biome is run via Bash — directly or through a package.json script — without ever blocking the command, so Bash stays a valid escape hatch. A `<biome_capability>` SessionStart block documents the division of labor between the LSP (automatic, read-only), the `biome_check` tool (on-demand, structured, can fix), and Bash.
