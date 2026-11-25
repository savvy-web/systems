---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

- `ChangesetLinter` now lints with `noInlineConfig`, so a changeset's own `<!-- markdownlint-disable -->` comments cannot silence its CSH and CF findings. `@effected/markdown-lint` 0.3.0 began honouring inline comments by default; this keeps the validation gate as strict as it was before.
