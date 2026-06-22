---
"@savvy-web/rspress-builder": patch
---

## Documentation

Added `@public` release tags to `RspressBundleOptions`, `RspressPluginOptions`, and `definePlugin` so they register correctly in the generated API model and pass the `ae-missing-release-tag` check. Fixed TSDoc syntax warnings: `{@link}` references replaced with backtick code spans, and bare scoped package names in prose escaped to satisfy the TSDoc parser.
