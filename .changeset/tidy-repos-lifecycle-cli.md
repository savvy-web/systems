---
"@savvy-web/cli": minor
---

## Features

`savvy repos` gains three new subcommands matching `ReposManager`'s new lifecycle operations:

- `savvy repos remove <name>` — unvendors a repo (gitlink, module gitdir, `.gitmodules` section, manifest entry).
- `savvy repos rename <old> <new>` — renames a vendored repo's worktree, git config, and manifest key.
- `savvy repos restore [names...]` — hard-resets dirty vendored repos back to their pinned commit; called with no names, restores every dirty repo and reports which were already clean.

`savvy repos status` gains a `--drift` flag that runs the new four-authority reconciliation (manifest, `.gitmodules`, worktree, `git submodule status`) and reports every disagreement found.
