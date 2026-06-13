---
"@savvy-web/cli": major
---

## Breaking Changes

### Removed changeset inspection subcommands

The following `savvy changeset` subcommands have been removed. They duplicated functionality now provided directly by the `changeset_inspect` MCP tool (modes `branch`, `config`, and `classify`) and the new `changeset_validate` MCP tool:

- `savvy changeset analyze-branch`
- `savvy changeset config show`
- `savvy changeset classify`
- `savvy changeset release-surface`

**Migration:** Use the `changeset_inspect` MCP tool instead. The `branch` mode replaces `analyze-branch`, the `config` mode replaces `config show` and `release-surface`, and the `classify` mode replaces `classify`.

The `savvy changeset config` group now exposes only `savvy changeset config validate`.

## Features

- Registered the `savvy changeset check` subcommand, which was previously implemented but not wired into the command tree.

## Bug Fixes

- `savvy changeset lint --json` and `savvy changeset deps detect --json` / `deps regen --json` now emit clean JSON to stdout without Effect.log timestamp prefixes.
