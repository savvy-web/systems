---
"@savvy-web/cli": minor
---

## Features

* `savvy lint init` now writes the `SAVVY-OKF` managed section to `.husky/pre-commit`, after the lint section, so a staged `okf/` bundle is synced in the same commit
* `savvy lint check` reports the OKF section's status alongside the base and lint sections: `up-to-date`, `outdated`, or `not found`
