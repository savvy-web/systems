---
"@savvy-web/cli": patch
---

## Bug Fixes

`savvy lint fmt pnpm-workspace` formats through `Lint.PnpmWorkspace.formatContentEffect`, so content that cannot be written as YAML fails as a typed error rather than an unhandled defect. The bytes written are unchanged.
