---
"@savvy-web/silk-core": minor
---

## Breaking Changes

Peer dependency ranges tightened: `effect` is now `~4.1.1` (previously `^4.0.0`), and the `@effected/*` kit peers moved to their current minors (for example `@effected/workspaces` `^0.41.0`, previously `^0.40.0`). Consumers on `effect` 4.0.x no longer satisfy the peer range and must upgrade to `effect` 4.1.x.
