---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/rspress-builder": minor
"@savvy-web/github-action-builder": patch
---

## Features

Resolve each package's own tsconfig for the declaration pass instead of synthesizing one that extends nothing, so declarations compile under the real effective compiler options rather than TypeScript defaults.

Align rspress-builder's public options with the bundler's own names. dtsBundledPackages becomes bundledPackages, apiModel becomes meta, and dtsExternals plus bundleNodeModules are exposed at both the build-wide and per-bundle levels.

## Bug Fixes

Removes the TsconfigResolver enum-conversion class, which nothing consumed, in favor of the tsconfig-json kit. Corrects a false doc comment on EntryOverride that implied an omitted option falls back to the base build's value, when in fact each partition builds from its own values only.

@savvy-web/github-action-builder now resolves its own tsconfig for the declaration pass, so its emitted declarations reference Node's URL type from node:url instead of the DOM global URL.

## Other

Both the TsconfigResolver removal and the rspress-builder option renames are released as minor rather than major, a deliberate SemVer deviation, because nothing outside this suite consumes either surface yet.
