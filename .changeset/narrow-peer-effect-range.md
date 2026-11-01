---
"@savvy-web/silk-effects": major
---

## Breaking Changes

Peer dependency ranges tightened: `effect` is now `~4.1.1` (previously `^4.0.0`), and the `@effected/*` kit peers moved to their current minors (for example `@effected/workspaces` `^0.41.0`, previously `^0.40.0`). Consumers on `effect` 4.0.x no longer satisfy the peer range and must upgrade to `effect` 4.1.x. Kit peers affected: `@effected/commands` `^0.19.0`, `@effected/git` `^0.29.0`, `@effected/templates` `^0.16.0`, `@effected/workspaces` `^0.41.0`.
