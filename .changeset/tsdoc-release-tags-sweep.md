---
"@savvy-web/github-action-effects": patch
"@savvy-web/github-action-builder": patch
"@savvy-web/silk-effects": patch
---

## Documentation

Added `@public` release tags across the public surface of all three packages so every exported symbol registers in the generated API model and passes the `ae-missing-release-tag` check. In `github-action-builder`, promoted the `Data.TaggedError` base classes and the `Schema`-derived type sources to `@public` to clear `ae-incompatible-release-tags`. Fixed TSDoc link warnings: unresolvable `{@link}` references (Effect `Context.Tag` service methods, which live in the tag's type argument rather than as class members, plus external symbols) were replaced with backtick code spans, ambiguous references were given member-reference selectors, and the stale `PublishabilityDetector` reference was retargeted to `SilkPublishability`. Removed stray `@packageDocumentation` tags from non-entry modules so only each package entry carries one.

This is a documentation-surface change only — every retagged symbol was already exported, and the build performs no `@internal` trimming, so the shipped type declarations are unchanged.
