---
"@savvy-web/mcp": patch
---

## Bug Fixes

* The `changeset_inspect` tool now refreshes the shared `ConfigInspector` (and its workspace discovery) at the start of every call, so edits to `.changeset/config.json` or the workspace made during a long-running session are visible immediately across `branch`, `config`, and `classify` modes — instead of serving state cached from the first call. Completes the staleness fix started in #262 for the dependency tools (#229).
