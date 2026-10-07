---
"@savvy-web/silk-effects": minor
"@savvy-web/cli": patch
---

## Bug Fixes

- The commitlint open-issues cache no longer lands under whichever subdirectory a hook ran from. When `CLAUDE_PROJECT_DIR` is unset, the cache path now resolves to the git repository root instead of the working directory, so a run from `packages/<pkg>` reuses the root `.claude/cache/issues.json` instead of leaving an untracked copy beside the package.

## Features

- `Commitlint.resolveIssuesCachePath()` resolves the open-issues cache path from `CLAUDE_PROJECT_DIR`, then the git repository root, then the working directory. Both `savvy commit hook` readers use it.
