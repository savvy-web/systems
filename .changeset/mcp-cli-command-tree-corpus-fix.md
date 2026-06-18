---
"@savvy-web/mcp": patch
---

## Documentation

### Corrected the `savvy` command-tree corpus doc

The `silk://packages/cli/command-tree` corpus doc that ships in the tarball listed the `savvy commit hook(...)` group with a `user-prompt-submit` handler that no longer exists, and prefixed the `savvy commit` and `savvy lint` groups with per-tool `init`/`check` subcommands that were removed earlier. The command tree now matches the shipped CLI: `savvy commit hook(session-start · pre-commit-message · post-commit-verify)` and `savvy lint fmt(...)` with no per-tool `init`/`check`.
