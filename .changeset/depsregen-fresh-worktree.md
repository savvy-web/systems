---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

`Changesets.DepsRegen.plan` now refreshes the `WorkspaceDiscovery` cache before taking its snapshots, so it diffs the workspace as it is on disk at plan time. Previously, in a process that had already enumerated the workspace before manifests were edited (the natural flow of an updater tool like silk-update-action), the worktree snapshot and the versionable-package gating were served pre-edit manifests from the discovery layer's lifetime cache, and the plan silently collapsed to zero changesets.
