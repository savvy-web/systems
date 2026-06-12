---
"@savvy-web/mcp": minor
---

## Features

Adds the `changeset_inspect` MCP tool, a read-only changeset analyzer for the changeset-manager workflow. `mode: "branch"` diffs the current branch against its base and classifies every changed file by owning package, returning the affected packages and the unmapped paths to ask the user about; `mode: "config"` surfaces the resolved `.changeset/config.json` (release surfaces, version files, ignore list). Results are returned as typed structured content, replacing the previous bash wrappers that parsed CLI stdout.
