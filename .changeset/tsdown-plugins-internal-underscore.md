---
"@savvy-web/tsdown-plugins": patch
---

## Build System

- Suppressed the `ae-internal-missing-underscore` API Extractor diagnostic. The underscore-prefix convention for `@internal` exports is not used in this monorepo, so the warning was noise; it is now silenced by default in the extracted message configuration.
