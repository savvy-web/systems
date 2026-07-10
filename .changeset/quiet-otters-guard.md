---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

* `Changesets.DepsRegen.plan()` no longer deletes a pure dependency changeset it isn't about to recreate (#258). The delete set is now restricted to packages that actually produced a fresh diff in the current run, and a changeset already committed at the merge-base ref — authored by an earlier, already-merged change — is never deleted by an unrelated branch's regen pass. Previously a devDependency-only manifest change silently destroyed the package's existing dependency changeset with nothing to replace it, and running regen on an unrelated branch could wipe out release notes for already-merged work.
* `ConfigInspector` and `ChangesetConfig` gained a `refresh()` method that drops their per-root caches, which otherwise never expire. `DepsRegen.plan()` now calls both up front, so long-lived host processes (for example, an MCP server holding one `DepsRegen` for its whole lifetime) see on-disk `.changeset/config.json` edits — the `ignore` list, `privatePackages.version`, and `baseBranch` — made between calls (#229).
