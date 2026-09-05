---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

* Fixed `generateBuildReportSchema()` throwing `is not a function` after `effect` 4.0.0-rc.112 removed `JsonSchema.resolveTopLevel$ref` from its public API. The top-level-`$ref` resolution it relied on is now implemented locally: a bare-`$ref` root is inlined from `#/$defs`, its now-redundant `$defs` entry is dropped, and any sibling keywords on the root are preserved.
* Fixed an orphaned `$defs` entry in the generated schema: the root definition's key is now derived from the `$ref` string itself (with JSON-Pointer unescaping) instead of a hard-coded `"BuildReport"` name, which no longer matched the emitted `"BuildReportEncoded"` key.
