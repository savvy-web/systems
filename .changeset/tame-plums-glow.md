---
"@savvy-web/silk-effects": minor
---

## Features

* Re-exports `SavvyOkfSection`, `savvyOkfSync`, and `savvyOkfBlock` from `@savvy-web/silk-core` — the `pre-commit` block that runs `okfit sync --staged` over an `okf/` knowledge bundle
* The commitlint `plan-leakage` rule now also flags commit bodies that cite an `okf/` path, alongside the existing `.claude/plans/` and `.claude/design/` checks
