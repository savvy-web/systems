---
"@savvy-web/silk": minor
---

## Features

### `/silk:tsdoc` skill

A new `silk:tsdoc` skill is available in the Silk plugin. It provides toolchain-accurate TSDoc authoring guidance tuned for the `@savvy-web/bundler` API Extractor pass, which fails CI on forgotten exports and undefined tags.

The skill covers:

- A quick-fix map for the common `ae-*` and `tsdoc-*` diagnostic codes (`ae-missing-release-tag`, `ae-forgotten-export`, `ae-incompatible-release-tags`, `ae-unresolved-link`, `tsdoc-undefined-tag`, and others)
- Release-tag policy: when to choose `@public`, `@internal`, `@beta`, or `@alpha`
- How to register a custom TSDoc tag in `savvy.build.ts`
- The complete set of supported standard tags
- Common JSDoc habits that break the TSDoc parser (brace-typed `@param`, missing hyphens, `@class`/`@module`)
- Documentation-depth guidance: structuring `@remarks`, `@example`, and prose for the RSPress API Extractor renderer so generated docs display rich narrative sections rather than bare type signatures

The skill auto-loads when editing `savvy.build.ts` and is user-invokable on demand via `/silk:tsdoc`.

### `tsdoctor` agent

A new `tsdoctor` agent drives TSDoc diagnostics to zero end-to-end. It builds the target package (prod), reads `dist/prod/issues.json`, applies the `tsdoc` skill's fix recipes for every `ae-*` and `tsdoc-*` diagnostic, and rebuilds to confirm the artifact is clean. The agent does not add `suppressWarnings` entries — suppression is a human escape hatch. Invoke via `/tsdoctor` or by asking Claude to fix TSDoc issues for a package.

### Issues monitor

A new background monitor (`watch-issues`) surfaces `ae-*` and `tsdoc-*` diagnostics from `dist/*/issues.json` as Claude Code notifications during development. The monitor watches for `issues.json` changes written by the build and reports new warnings or errors without requiring a manual log scan.
