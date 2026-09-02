---
"@savvy-web/cli": minor
---

## Features

### Package-manager toolchain drift warning in hooks

`savvy init` now writes a `SAVVY-TOOLCHAIN` section into `.husky/post-checkout` and `.husky/post-merge`, warning when the local package manager's version has drifted off the repo's `devEngines.packageManager` pin. It is not added to `post-commit`, which fires on every commit and would be noisier than the drift warrants.

`savvy check` reports the section's presence and freshness for both `lint` and `commit` checks, prompting a re-run of `savvy init` when the section is missing or outdated.

## Build System

* Bump the pinned Biome version `savvy init` / `savvy check` sync into consumer `biome.json` `$schema` URLs to 2.5.11
