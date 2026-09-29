---
"@savvy-web/silk-effects": minor
---

## Features

### Grep-Visible Text Lint

`Lint.TextFiles` fails any source or text file that grep and ripgrep would silently skip as binary: a file containing a NUL byte anywhere, or bytes that are not valid UTF-8. Each finding carries the path, the reason, and the line, column and byte offset of the first offending byte. A literal NUL is fixed mechanically by writing the `\0` escape instead.

The lint-staged handler runs `savvy lint text --staged` over the matching files, reading each file's staged copy from the git index so the check sees exactly what is committed and cannot race a concurrent formatter. It is on by default in `Preset.silk()`, `Preset.standard()` and `createConfig`, off in `Preset.minimal()`, and can be disabled with `textFiles: false`.
