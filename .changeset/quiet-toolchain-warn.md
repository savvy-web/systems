---
"@savvy-web/silk-effects": minor
---

## Features

### Package-manager toolchain drift check

Adds `SavvyToolchainSection` and `savvyToolchainCheck()`, a new `SAVVY-TOOLCHAIN` managed hook section that warns when the running package manager's version has drifted off the repo's `devEngines.packageManager` pin.

* Warn-only — never blocks the hook and never installs anything
* Skipped under CI, where the runtime action installs the pin by construction
* Honours the `name` recorded in the pin rather than assuming pnpm
* Strips the `+sha512…` integrity tail before comparing, and skips inexact pins (ranges, wildcards)
* Self-contained: defines its own root/CI/pin lookups rather than depending on `SavvyBaseSection`, since its homes (`post-checkout`, `post-merge`) carry `SavvyHooksSection` but no `SavvyBaseSection`

```ts
import { SavvyToolchainSection, savvyToolchainCheck } from "@savvy-web/silk-effects";

const section = SavvyToolchainSection.section(savvyToolchainCheck());
```
