---
"@savvy-web/silk": minor
---

## Features

### TextFiles Lint Handler

`@savvy-web/silk/lint` re-exports the `TextFiles` handler and its types, so repos using the `silk` or `standard` lint-staged preset now reject commits that stage a file with a NUL byte or invalid UTF-8.
