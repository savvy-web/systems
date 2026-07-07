---
"@savvy-web/changelog": patch
---

## Bug Fixes

* Default export now typed as the nominal `ChangelogFunctions` from `@changesets/types` instead of typeof-chaining through the `@savvy-web/silk-effects` namespace
* Published `index.d.ts` shrinks from ~644KB to ~2KB; the redundant per-module declarations pass and `declare module "./Effect.js"` build warnings are gone
* No runtime behavior change
