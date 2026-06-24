---
"@savvy-web/silk": patch
---

## Documentation

The `/silk:tsdoc` skill's guidance on locating `ae-*` and `tsdoc-*` diagnostics has been updated to reflect that `file`/`line`/`column` fields in `issues.json` are now accurate.

- The previous guidance (systems#154) advised locating diagnostics by the symbol name quoted in `text`, because location fields were suppressed as misleading. That guidance is reverted.
- The current guidance: navigate to the `file:line` reported in the diagnostic. Most entries resolve to `src/*.ts` (accurate). The exception is Effect `Data.TaggedError` / service classes whose synthesized `_base` declaration is not source-mapped by rolldown-plugin-dts — those may report a path inside `dist/prod/<id>/declarations/*.d.ts`. In that case, use the symbol name in `text` to find the matching `src/*.ts` declaration.
