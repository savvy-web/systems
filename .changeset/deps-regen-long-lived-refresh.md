---
"@savvy-web/silk-effects": minor
---

## Bug Fixes

### Dependency Regen Stays Fresh in Long-Lived Hosts

`DepsRegen.plan` now refreshes the memoized lockfile and catalog assembly before snapshotting the working tree, so a long-lived host such as the savvy-mcp server sees the tree as it is on each call. Previously the first call's catalogs and config-dependency replays were reused for the process lifetime: after a branch switch that changed a config dependency the plan failed with `HookReplayError`, and catalog or lockfile edits silently produced an empty diff. Explicit `from` and `to` refs are now resolved to a commit before lookup, so a moving branch name is no longer frozen at the first commit seen. `BranchAnalyzer` and `ReleasePlanner.apply` refresh workspace discovery per call for the same reason.

## Breaking Changes

### DepsRegen.layer Requires Catalogs and Lockfile Services

`DepsRegen.layer` now requires `WorkspaceCatalogs` and `LockfileReader`, which it refreshes before each plan. They must be the same instances the provided `WorkspaceSnapshots` reads. `DepsRegenDefault` and `makeDepsRegenDefault` already provide both, so only a hand-composed `DepsRegen.layer` graph needs to add them.
