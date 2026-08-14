---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

The lint-staged type-check handler now prefers `tsc` over `tsgo` when detecting a TypeScript compiler, so the pre-commit gate runs the same compiler as a repo's own `types:check` task. Previously, any repo with `@typescript/native-preview` anywhere in its dependency graph — even as a hoisted or transitive dep — silently got `tsgo` for its commit gate with no way to opt out.

* `Lint.TypeScript.detectCompiler()` checks `tsc` first and falls back to `tsgo`
