---
"@savvy-web/silk": minor
---

## Features

### New `gitmodules-drift` monitor

A background monitor now watches `.gitmodules` and `.repos/config.json` and notifies when `savvy repos status --drift` reports disagreement between the manifest, `.gitmodules`, the worktree, and `git submodule status`. It's notify-only — filesystem and subprocess access only, never mutates anything, and fails open (silently) when the `savvy` CLI isn't available in the project.

## Bug Fixes

The `repos-bash-guard` hook's lifecycle-operation deny messages now point at the sanctioned tool for each case instead of a single generic message: unvendoring (`git rm`/`git submodule deinit`) points at `repos_manage`/`savvy repos remove`, and renaming (`git mv`) now points at `repos_manage`/`savvy repos rename` now that those primitives exist. The guard also now denies `git reset --hard`/`git clean` against vendored paths, pointing at `repos_manage`/`savvy repos restore` — recovering a dirty vendored tree is a lifecycle operation with its own sanctioned primitive, not a raw git reset.

## Documentation

The `repos` skill's lifecycle coverage is fully rewritten to document the `remove`/`rename`/`restore` operations and the `status --drift` reconciliation report.
