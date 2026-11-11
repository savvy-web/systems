---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

The `Lint` workspace helpers keep their best-effort fallback on `@effected/workspaces` 0.46. That release made the sync package discovery throw `WorkspaceDiscoveryError` or `WorkspacePatternError` for an unreadable, unparseable or unexpandable workspace manifest, where it used to return an empty list. The lint-staged handlers again treat such a workspace as having no leaf packages instead of crashing, and any other error still propagates.
