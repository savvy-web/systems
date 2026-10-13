---
"@savvy-web/silk-core": patch
---

## Bug Fixes

- The `SAVVY-OKF` pre-commit section no longer passes the project root to `okfit sync` as a positional argument, which `@okfit/cli` 0.13.0 refuses and which failed every commit. The sync now runs from `$ROOT` in a subshell, so the CLI's default root applies on okfit versions before and after 0.13.0 without a version probe. Run `savvy init` to regenerate the section in an existing hook. Closes #788.
