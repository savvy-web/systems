---
"@savvy-web/silk": patch
---

## Bug Fixes

### `repos-bash-guard.sh`: stop false-positive denies, name what it's denying

The repos vendored-tree Bash guard hook now scans a derived `SCAN` string instead of the raw command, stripping heredoc bodies and whitespace-containing quoted segments before matching. This stops it from denying commands that only mention `.repos/` inside prose — a heredoc payload, or a quoted sentence like `--body "run rm -rf .repos/x to reproduce"` — and from denying plain reads (`cat`, `grep`, `rg`, `ls`) of vendored paths, which were never writes.

The non-git leg's `cp`/`mv` last-operand scan is now clause-scoped, so it no longer misreads an operand from an unrelated `&&`/`;`/`|`-separated command in the same string. `git add`/`git restore` are now allowed when every `.repos/`-mentioning token in the invocation resolves to exactly `.repos/config.json`, so staging the hand-editable manifest no longer trips the guard; a mixed pathspec that also touches vendored content still denies. Deny messages now name the actual operation (`unvendoring a repo is a lifecycle operation...` for `git rm`/`git submodule deinit`) instead of a one-size "re-pin via repos_manage" message that didn't fit every denied shape.

## Documentation

The `repos` skill now documents the OS-level read-only boundary: `ReposLockdown` (from `@savvy-web/silk-effects`) is the actual backstop on vendored trees, and this Bash guard hook is early-warning UX ahead of it, not the security boundary itself.
