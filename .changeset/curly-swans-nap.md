---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

* `VersionFiles.updateFile` now performs format-preserving in-place edits via jsonc-effect's `modify`/`applyEdits` (minimal edit spans, requires `jsonc-effect >= 0.3.1`) instead of round-tripping through `JSON.parse`/`JSON.stringify`, so a version bump produces a one-line diff and the rest of the document — inline arrays, comments, indentation — survives byte-for-byte (closes #234)
* JSONC documents (comments, trailing commas) are now supported in versionFiles-managed files; the dry-run preview paths in `processVersionFiles`/`processResolvedVersionFiles` parse via jsonc-effect too, so a commented file previews cleanly instead of throwing
* A wildcard-free JSONPath whose leaf property does not yet exist is now inserted using the document's detected indent, instead of being silently skipped
