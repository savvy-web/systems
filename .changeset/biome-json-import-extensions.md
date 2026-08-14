---
"@savvy-web/silk": patch
---

## Bug Fixes

Stops the Biome preset's `useImportExtensions` autofix from rewriting correct `.json` (and other asset) imports to `.js`, which broke module resolution. The preset now uses `extensionMappings` (`ts`/`tsx` to `js`, `mts` to `mjs`, `cts` to `cjs`) instead of the legacy `forceJsExtensions: true`, so unmapped extensions like `json` and `css` keep the imported file's real extension. The now-redundant `.tsx` override that partially worked around the same problem is removed.

* JSON asset imports (including `with { type: "json" }`) are no longer flagged or rewritten
* Missing-extension TypeScript imports still receive the correct emitted `.js`/`.mjs`/`.cjs` extension
* Existing `biome-ignore lint/correctness/useImportExtensions` suppressions for asset imports become unnecessary (and will surface as unused-suppression warnings)
