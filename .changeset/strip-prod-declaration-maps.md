---
"@savvy-web/tsdown-plugins": patch
"@savvy-web/bundler": patch
---

## Bug Fixes

### Strip declaration source-maps from the published prod package

The prod build no longer ships `.d.ts.map` / `.d.cts.map` files in the published `pkg/` directory. They are emitted for meta generation (API Extractor reads them for original-source positions) but reference TypeScript sources the tarball does not ship, so they are dead weight that also leaks local source paths. The new `removeDeclarationMaps` helper strips them from each prod group's `pkg/` after meta generation has consumed them; the dev build keeps them so `savvy build --target meta` still works. The front door does this in `runBuild`; the two self-hosting builders do it in their escape-hatch build scripts.
