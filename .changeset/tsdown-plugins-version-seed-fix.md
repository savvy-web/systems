---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

* `resolveNextVersions` no longer seeds a version-less workspace member into its `versions` map with a fabricated current version — there is nothing to seed. A changeset that bumps such a package still overlays its `newVersion` as before.
