---
"@savvy-web/silk-effects": minor
---

## Features

### ReposManager.deregister — clear a stale submodule registration

New `deregister(root, section)` on `Repos.ReposManager`, closing the asymmetry where `ReposDrift` reported an orphaned `submodule.<section>.*` local-config section (left behind by a rename or an unvendoring) but no tool performed the remedy. The section argument is the registration name exactly as the drift report states it; the removal is one `Git.configRemoveSection` call.

* Refuses, typed and before any mutation: a section outside `.repos/` (a host repo's own submodule registration is not this machinery's to clear), the canonical registration of a live manifest entry, and a live registration under a diverged name — identified by the same module-gitdir attribution the drift check uses, since that state's remedy is a re-vendor, not a deregister
* Treats a missing manifest as empty, since a stale registration can outlive the manifest itself
* Probes the config first, so a typo fails typed as nothing-to-deregister instead of git's loud exit 128, and the new `ReposDeregisterResult` reports the keys the removed section actually carried
* Touches only the superproject's local config — no lockdown bracket, nothing staged, no commit message
* The drift report's orphan remedy now names `savvy repos deregister` instead of a raw `git config --remove-section`

## Refactoring

### sync no longer flips the boundary marker around its initialize call

`sync`'s initialize branch now passes `--checkout` to `git submodule update` — git's documented command-line override of the `submodule.<path>.update = none` boundary marker, exposed by `@effected/git` 0.8.0. The temporary flip of the marker to `checkout` and its restoring bracket are gone, removing two config writes per repo per sync and the crash window that could leave the marker neutralized.
