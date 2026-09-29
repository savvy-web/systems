---
"@savvy-web/cli": minor
---

## Features

### savvy lint text

`savvy lint text [files…]` reports every file that is not grep-visible text (a NUL byte or invalid UTF-8) as `path:line:col` with a fix hint, and exits 1 on any finding. With no arguments it checks every git-tracked source and text file; `--staged` reads each file from the git index instead of the working tree.
