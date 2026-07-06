---
"@savvy-web/mcp": patch
---

## Bug Fixes

* Declared `@effect/experimental` and `@effect/workflow` as regular dependencies, completing the Effect peer-dependency closure. Both were required peers of the already-declared `@effect/sql` and `@effect/cluster`, so pnpm auto-installed them at the consumer's importer level, where a consumer depending on a different major of `effect` could bind them against an incompatible `effect` instance (#228)
