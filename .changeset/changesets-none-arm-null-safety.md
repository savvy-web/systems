---
"@savvy-web/silk-effects": patch
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

Guard against missing version endpoints on changesets releases typed as none. The changesets types package only guarantees oldVersion and newVersion on the major, minor and patch arms of ComprehensiveRelease, so an entry typed none may carry neither.

The dependency changelog table now drops entries missing either endpoint rather than rendering an empty From or To cell. Maintenance-reason derivation no longer names a none co-member as a release trigger, which printed an unchanged version as the cause of the release. Next-version resolution skips releases with no newVersion instead of overwriting the seeded current version with undefined.
