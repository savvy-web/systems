---
"@savvy-web/silk": patch
---

## Bug Fixes

- Fix the silk plugin's skill-script repository resolution: `commit.sh`, `validate-message.sh`, and `changeset/list.sh` now resolve the target repository from the caller's working directory first (via a shared `resolve-cli-project-dir.sh` helper), treat `SILK_PROJECT_DIR` as an explicit override with a stderr notice when it diverges, and refuse with both paths named when an inherited `CLAUDE_PROJECT_DIR` points at a genuinely different repository. Previously a stale inherited environment variable silently ran `git commit` against the wrong checkout from worktrees and sibling repos.
