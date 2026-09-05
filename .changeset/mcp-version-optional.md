---
"@savvy-web/mcp": minor
---

## Features

`workspace_info`'s `WorkspaceSummary.version` and the `changeset_inspect` package listing now treat a version-less workspace member as a normal result instead of an error, following `@effected/workspaces` 0.19.0's retirement of the `missingVersion` discovery failure.

* `WorkspaceSummary.version` is now optional; the `workspace_info` markdown table renders an em dash (`—`) for a package with no version
* `changeset_inspect`'s markdown omits the `(version)` parenthetical after a package name when it has none
