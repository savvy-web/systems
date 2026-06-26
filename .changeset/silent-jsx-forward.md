---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

Removed the non-functional `jsx` field from `BuildTargetGroupsOptions`, `DeriveOptions`, and the three derived pass-option interfaces. The field was being forwarded into rolldown's `inputOptions`, which rejected it on every JSX build pass with an "Invalid input options ... Expected never but received \"jsx\"" warning. JSX compilation was already applied correctly via the generated tsconfig, so the forward had no effect on emitted output.

- `JsxConfig`, `resolveJsxConfig`, and `readTsconfigJsx` remain exported and unchanged
