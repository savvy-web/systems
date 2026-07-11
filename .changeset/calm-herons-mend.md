---
"@savvy-web/silk": patch
---

## Bug Fixes

* The GitKraken MCP auto-allow matcher in `hooks.json` only ever matched `mcp__gk__*`, a prefix no real GitKraken MCP server registers under — the allowlist never fired and every GitKraken read op prompted for permission. The matcher now also covers `mcp__gitkraken__*` and `mcp__GitKraken__*`, so read-only ops (`git_status`, `git_log_or_diff`, and friends) are auto-allowed. `git_add_or_commit` and `git_push` are deliberately left off the auto-allow list so MCP-driven commits and pushes still prompt — auto-allowing them would bypass commit-message validation and the changeset-push-guard.
* `allowed-tools` in the `commit-create`, `config`, and `dependencies` skills is normalized from space-separated to comma-separated, fixing a grant that risked being mis-parsed. `config` also drops an unused `changeset_validate` grant, and the `turborepo` agent drops its dead `ListMcpResourcesTool`/`ReadMcpResourceTool` grants now that `savvy-mcp` is tools-only.
* The `status` skill no longer references `/silk:update`, `/silk:merge`, or `/silk:delete` — those are internal mechanics invoked by the changeset-manager agent, not user-facing commands. It now points at `/silk:changeset --create` and `/silk:changeset --squash` instead.
