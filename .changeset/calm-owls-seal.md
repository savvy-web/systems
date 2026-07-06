---
"@savvy-web/cli": patch
---

## Bug Fixes

* Declared `@effect/experimental`, `@effect/workflow`, `@effect/printer`, `@effect/printer-ansi`, and `@effect/typeclass` as regular dependencies, completing the Effect peer-dependency closure. All five were required peers of already-declared packages (`@effect/sql`, `@effect/cluster`, `@effect/cli`, and the printer pair), so pnpm auto-installed them at the consumer's importer level, where a consumer depending on a different major of `effect` could bind them against an incompatible `effect` instance (#228)
