---
"@savvy-web/tsdown-plugins": patch
---

## Refactoring

* Replaced the `deep-equal` dependency with `node:util`'s `isDeepStrictEqual` in the tsdoc.json idempotent-write check
* `deep-equal` and `@types/deep-equal` removed from dependencies
* No behavior change
