---
"@savvy-web/silk": minor
---

## Features

* The `./changesets/markdownlint` rules now come from the shared `@effected/markdown-lint` definitions. Rule names, ids and exports are unchanged, but the rules report what `ChangesetLinter` reports, including the new findings on indented code blocks and on CSH005 tables (reported at the table line)
