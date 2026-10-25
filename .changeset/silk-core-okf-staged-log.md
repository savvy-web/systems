---
"@savvy-web/silk-core": patch
---

## Bug Fixes

- The SAVVY-OKF pre-commit section now keeps okfit's log mode on when the bundle has unstaged or untracked work, running `okfit sync --staged --only generated --only log` and dropping only index mode. With okfit 0.14.0, a commit that touches a concept now carries its own `log.md` entry in both cases, instead of leaving it for a follow-up commit. Closes #796
