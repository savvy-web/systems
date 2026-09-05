---
"@savvy-web/silk-effects": minor
---

## Features

Follows `@effected/workspaces` 0.19.0's retirement of the `missingVersion` discovery failure: a manifest with no `version` field is now a legally discovered workspace member instead of a discovery error, so the version-related shapes widened to admit it honestly rather than defaulting or filtering it out.

* `AnalyzedWorkspace.version.current` is now optional — a version-less package (a private monorepo root, or any private package with no declared `version`) discovers cleanly instead of failing
* `PublishablePackage.version` and `ResolvedPackageScope.version` are now `string | undefined` for the same reason

## Bug Fixes

* `AnalyzedWorkspace.toString()` renders just the package name when it has no version, instead of `name@undefined`
* `VersionFiles.processResolvedVersionFiles` now skips a scope whose manifest declares no version, leaving its `versionFiles` targets untouched rather than stamping them with a fabricated version
