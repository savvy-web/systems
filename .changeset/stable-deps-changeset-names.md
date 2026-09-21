---
"@savvy-web/silk-effects": minor
---

## Features

### Stable filenames for dependency changesets

- `DepsRegen` writes each package's pure-dependency changeset to a stable, package-derived filename — `<scope>-<name>-deps.md` for scoped packages (`savvy-web-cli-deps.md`), `<name>-deps.md` otherwise — instead of a random `<adjective>-<noun>-<verb>` slug. A re-run overwrites the same file in place, so a no-op regen produces no file churn; a legacy random-named pure-dependency changeset for the same package is deleted on the first regen that rewrites it. Detection still classifies by content, so hand-written pure-dependency changesets under other names keep working.

### Guard against unreplayed config-dependency hooks

- `DepsRegen.plan()` fails with the new typed `HookReplayError` when a ref's `pnpm-workspace.yaml` declares `configDependencies` that its workspace snapshot did not replay. Catalogs injected only by a config-dependency hook (`catalog:*:peers`) leave no lockfile trace, so a non-replaying graph previously diffed them as unchanged and silently dropped every `peerDependency` row across a config-dependency bump. With `@effected/workspaces` 0.24.0 replaying each ref's declared hook version from the local pnpm store, those rows now appear; the guard makes any regression loud.

## Bug Fixes

- Dependency changesets generated across a config-dependency bump no longer omit `peerDependency` rows resolved through hook-injected catalogs.
