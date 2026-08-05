---
"@savvy-web/cli": minor
"@savvy-web/mcp": minor
---

## Features

Both `savvy repos` (cli) and `repos_manage` (mcp) now provide `Repos.ReposLockdown.layer` alongside `Repos.ReposConfigStore.layer` when assembling `Repos.ReposManager.layer`, matching the vendored-repos read-only permissions enforcement added to `@savvy-web/silk-effects`. The exported `reposCommand` (cli) and `reposManage` (mcp) error unions each widen to include `Repos.ReposLockdownError`, surfaced if a lock/unlock chmod fails around a `sync`/`add`/`pin` operation.
