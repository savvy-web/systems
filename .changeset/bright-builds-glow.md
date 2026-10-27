---
"@savvy-web/bundler": minor
---

## Features

* Build-log colour now honours `FORCE_COLOR`: it forces colour on piped or CI output and takes precedence over `NO_COLOR`; `FORCE_COLOR=0` disables colour. A TTY with no `TERM` or `COLORTERM` hint now prints plain output.

## Bug Fixes

* CI detection now recognizes `CI=1`, `CONTINUOUS_INTEGRATION` and other providers' markers (GitLab, Buildkite and others) as CI. `CI=false` and `CI=0` no longer count as CI.
