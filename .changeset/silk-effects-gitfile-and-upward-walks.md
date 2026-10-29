---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

- `Repos` reads a submodule's `.git` pointer file by git's own rules (`@effected/git`'s `GitFile`). A pointer git refuses, such as `gitdir:` with no space, is no longer followed; the name-based module path is used instead, as it already was for a pointer that escapes the repository.

## Refactoring

- `Lint`'s `Command.findRoot` and the commitlint DCO detection find the nearest marker with `@effected/walker`'s synchronous upward walk instead of a hand-written loop. The roots they find are unchanged.
