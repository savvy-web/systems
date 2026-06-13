---
"@savvy-web/mcp": minor
---

## Features

Adds the `biome_check` MCP tool, a thin proxy that runs Biome over a path and returns structured diagnostics instead of console text. Use `mode: "check"` (the default — lint, format, and organize-imports) or `mode: "lint"`; set `write` to apply safe fixes (`--write`) or `unsafe` to apply unsafe fixes (`--write --unsafe`). The tool parses Biome's gitlab reporter into a typed payload with per-file severity, rule, and message, alongside a markdown summary. Unlike the other savvy-mcp tools, `biome_check` can mutate the working tree when `write` or `unsafe` is set, so it carries no read-only hint.
