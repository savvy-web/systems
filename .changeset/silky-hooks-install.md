---
"@savvy-web/silk-effects": minor
---

## Features

### Dependency auto-install shell block

Adds `savvyInstallDeps(hook)` and `savvyInstallBlock(hook)`, a shell block for savvy-managed husky hooks that brings `node_modules` back in line after a branch switch or a pull — so a batch of repos pulled to align dependencies doesn't each need a manual install.

```ts
import { savvyInstallBlock } from "@savvy-web/silk-effects";

const section = savvyInstallBlock("post-checkout"); // or "post-merge"
```

It detects the package manager from `packageManager` in `package.json`, falling back to a lockfile ladder (pnpm, yarn, bun, npm), then runs `<pm> install --ignore-scripts` — or `--mode=skip-build` for Yarn Berry, which dropped that flag.

Four guards keep it a silent no-op outside real dependency events:

* CI, where the runtime action already owns installation
* `SAVVY_SKIP_INSTALL`, an escape hatch for a bisect or scripted sweep
* on `post-checkout`, a branch-flag of `0` (a file checkout, not a move between commits)
* a diff gate — it only runs when a manifest or lockfile actually changed across the move, so an ordinary branch switch costs nothing (a missing `node_modules` overrides this gate)

The install's exit status is swallowed so a failed install never looks like a failed checkout.

One shape of repo cannot afford `--ignore-scripts` and is detected rather than warned about. Where a package publishes through a built link directory — `publishConfig.directory` together with `linkDirectory: true` — the workspace resolves its own dependencies through a directory that a `prepare` script has to build, and skipping scripts leaves a populated `node_modules` pointing at nothing. A workspace declaring that combination in any tracked manifest takes a full install instead. Detection reads the git index, so an untracked manifest does not count: it cannot have arrived with the checkout that triggered the hook. Everywhere else the flag stays on and the hook prints a line saying scripts were skipped.

A fresh clone is not covered, and cannot be: husky sets `core.hooksPath` from its own `prepare` script, so until the first manual install runs there is no hook installed to fire.
