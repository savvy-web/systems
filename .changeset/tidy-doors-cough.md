---
"@savvy-web/mcp": patch
---

## Bug Fixes

* Fixed a duplicated error detail in tool failure messages: when an engine error's own message already folds in its cause (e.g. `CatalogAssemblyError` since `@effected/npm` 0.17.0), the cause's message is no longer appended a second time.
