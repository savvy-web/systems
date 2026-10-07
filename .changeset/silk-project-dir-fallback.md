---
"@savvy-web/ai-plugins": patch
---

## Bug Fixes

- `commit.sh`, `validate-message.sh` and the changeset `list.sh` no longer let an inherited `SILK_PROJECT_DIR` override the working tree you are standing in. Inside a git worktree, a `SILK_PROJECT_DIR` naming another worktree of the same repository is ignored with a notice, and one naming a different repository is refused with both paths named. Previously a subagent started in a worktree by a coordinating session committed into that session's main checkout. `SILK_PROJECT_DIR` now only applies when the working directory is outside any git repository; to target another repository, `cd` into it.
