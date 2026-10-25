---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

- Fixed suppressed API Extractor messages going missing from `issues.json` when they exist only in the bundled declarations. The split meta pass now records the messages its first run (over the bundled rollup) suppressed and the per-module run never saw. They appear in `suppressed` without a file or line, the same way rollup-only warnings do, so the `suppressed` count now equals what a package's `suppressWarnings` rules absorbed. Closes #772

## Documentation

- Corrected the 2.11.0 release notes. Moving declaration emit to TypeScript 7.1 does change some emitted declarations. An exported object literal whose properties are imported values that are not exported now emits `typeof localName` references in place of the inlined signatures TypeScript 6 produced, and API Extractor reports `ae-forgotten-export` for each referenced value. No compiler option restores the old form. Export the referenced values from the entry point, or give the object an explicit type annotation. Closes #824
