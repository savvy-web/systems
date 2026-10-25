---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

- Fixed suppressed API Extractor messages going missing from `issues.json` when they exist only in the bundled declarations. The split meta pass now records the messages its first run (over the bundled rollup) suppressed and the per-module run never saw. They appear in `suppressed` without a file or line, the same way rollup-only warnings do, so the `suppressed` count now equals what a package's `suppressWarnings` rules absorbed. This also holds when the build fails on a CI-fatal message. Closes #772

## Documentation

- Corrected the 2.11.0 release notes. Moving declaration emit to TypeScript 7.1 does change some emitted declarations. An exported object literal whose properties are imported values that are not exported now emits `typeof localName` references in place of the inlined signatures TypeScript 6 produced, and API Extractor reports `ae-forgotten-export` for each referenced value. No compiler option restores the old form. Fix it at the declaring site, in this order: inline the value into the member, or make it a static method, and annotate the member's type only where the local has to stay. Don't export the locals from the entry point just to silence the warning, because that grows the public API. Closes #824
