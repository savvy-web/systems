---
"@savvy-web/cli": minor
---

## Features

* `savvy changeset lint`, `savvy changeset check` and `savvy changeset validate-file` now report the changeset front-matter rules (CF001-CF003) in addition to CSH001-CSH005
* Front-matter package names are checked against the workspace's packages (CF004). The check is skipped when the workspace cannot be discovered
