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

Lifecycle scripts are skipped by default and re-enabled only by the LOCAL git config key `savvy.installLifecycleScripts`. A workspace publishing through built link directories (`publishConfig.directory` with `linkDirectory: true`) needs them — its own workspace links resolve through directories a `prepare` script produces — and `savvy init` now says so and prints the command, leaving the decision to the person who owns the checkout.

The decision deliberately does not read the checked-out tree, which failed in both directions at once. A branch that merely declared the shape could have turned lifecycle scripts back on just by being checked out, making `git checkout` of an untrusted revision a code-execution path; and the `jq` such a scan needs is absent on stock macOS and Ubuntu, where the missing answer silently skipped scripts in precisely the repos that cannot survive it. `.git/config` is neither checked out nor parsed with `jq`.

`packageManager` is likewise attacker-controlled input, so the parsed name is checked against `npm`, `pnpm`, `yarn` and `bun` before anything runs — `command -v` proves a binary exists, not that it is a package manager.

Also adds `publishesBuiltLinkDirectory` and `LIFECYCLE_SCRIPTS_CONFIG_KEY` for consumers that want to detect the shape or name the key themselves.

A fresh clone is not covered, and cannot be: husky sets `core.hooksPath` from its own `prepare` script, so until the first manual install runs there is no hook installed to fire.
