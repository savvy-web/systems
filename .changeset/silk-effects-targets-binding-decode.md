---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

- `readTargetsBinding` now decodes `dist/prod/targets.json` against a schema rather than casting it. A file that is valid JSON but the wrong shape, such as `{}`, now reads as no binding (`null`), as the function's contract states, instead of crashing publishability detection later. Closes #575
