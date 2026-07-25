---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

* The changesets `ConfigInspector` fallback-scope builder now honors `.changeset/config.json`'s `privatePackages.version` — a private root or private workspace package joins the release surface instead of yielding an empty `packages[]` and leaving every file unmapped.
* `ConfigInspector.classify` no longer lets a root-as-package scope win directory containment ahead of a more specific claim. Because the root's workspace directory contains every file in the repo, a versioned root would otherwise shadow the `additionalScopes` and `versionFiles` a config declared for any path outside a sub-package directory. The root now applies as a last-resort fallback, which is what a single-package root-as-package repo relies on.
