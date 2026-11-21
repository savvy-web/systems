---
"@savvy-web/silk-core": minor
"@savvy-web/silk-effects": major
---

## Breaking Changes

`BiomeSyncError` no longer has a free-form `reason` string. It now carries a `code` (the new `BiomeSyncErrorCode`: `"read-failed"`, `"parse-failed"`, `"edit-failed"` or `"write-failed"`) naming the stage that failed, and a `cause` holding the original filesystem or JSONC error unchanged. The `message` is derived from `path` and `code` and no longer includes the underlying error text. Code that built a `BiomeSyncError` with `reason` must pass `code` and `cause` instead, and code that inspected the failure should match on `code`, not on message text. `BiomeSyncErrorCode` is exported from `@savvy-web/silk-core` and re-exported from `@savvy-web/silk-effects`.
