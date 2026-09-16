---
"@savvy-web/silk-core": minor
---

## Features

* `SavvyOkfSection` — the `SectionId` for a `SAVVY-OKF` managed section (hash-comment style), pairing with `savvyOkfSync`
* `savvyOkfSync()` / `savvyOkfBlock()` — the OKF bundle sync block for `pre-commit`, running `okfit sync --staged` so a staged concept's `generated.at` stamp lands in the same commit as the edit that moved it
  * Silent no-op in CI, when the repo carries no `okf/` bundle, or when no local `okfit` binary is installed
  * A non-zero `okfit` exit fails the commit
