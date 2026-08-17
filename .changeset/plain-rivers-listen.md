---
"@savvy-web/silk-effects": patch
---

## Refactoring

Version-file I/O now runs through the Effect `FileSystem` service instead of
`node:fs`. Behavior is unchanged: `ReleasePlanner.apply` still surfaces a
version-file write failure as a typed `ReleasePlanError`, and the deprecated
top-level `versionFiles[]` path still fails as a defect.

* `VersionFiles` reads and writes through `FileSystem`, so its members are now
  Effects requiring `FileSystem.FileSystem` — an internal surface, not exported
  from the package root
* Package-manifest parsing is fail-soft as before, including on malformed JSON
