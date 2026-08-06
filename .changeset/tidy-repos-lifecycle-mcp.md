---
"@savvy-web/mcp": minor
---

## Features

`repos_inspect` gains two new modes: `drift` runs the four-authority reconciliation (manifest, `.gitmodules`, worktree, `git submodule status`) and returns every disagreement found; `gitmodules` returns the decoded `.gitmodules` sections directly (or a parse error).

`repos_manage` gains three new actions matching `ReposManager`'s new lifecycle operations: `remove` (unvendor a repo), `rename` (rename a vendored repo's worktree, git config, and manifest key), and `restore` (hard-reset dirty vendored repos back to their pinned commit).
