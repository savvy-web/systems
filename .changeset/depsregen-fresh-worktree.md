---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

`Changesets.DepsRegen.plan` now refreshes the `WorkspaceDiscovery` cache before any workspace read — the `ConfigInspector` base-branch fallback, the worktree snapshot, and the versionable-package gating — so it diffs the workspace as it is on disk at plan time. Previously, in a process that had already enumerated the workspace before manifests were edited (the natural flow of an updater tool like silk-update-action), those reads were served pre-edit manifests from the discovery layer's lifetime cache, and the plan silently collapsed to zero changesets.

## Dependencies

| Dependency        | Type       | Action  | From   | To     |
| ----------------- | ---------- | ------- | ------ | ------ |
| workspaces-effect | dependency | updated | ^2.0.2 | ^2.0.3 |
