---
"@savvy-web/rspress-builder": patch
---

## Build System

* `@savvy-web/bundler` is now published as a caret range (`^<version>`) instead of an exact pin, so consumers pick up compatible bundler releases, including the per-target release filter in bundler 2.6.0, without waiting for an rspress-builder release.
