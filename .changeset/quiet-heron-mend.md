---
"@savvy-web/github-action-builder": patch
---

## Bug Fixes

* Fixed `ERR_MODULE_NOT_FOUND 'redis'` on Yarn 1 installs by importing `@effect/platform-node`'s subpaths instead of the package root.
