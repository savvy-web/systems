---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

The API Extractor doc model now sets `includeForgottenExports: true`, so declarations that are referenced but not exported are retained in the emitted `.api.json` instead of being dropped. The motivating case is the synthetic `*_base` class TypeScript hoists when emitting declarations for Effect class mixins (`Schema.Class`, `Data.TaggedError`, `Context.Tag`, `Effect.Service`): its name is not exportable from source, so it was always a forgotten export and the model lost it — leaving a dangling `extends *_base` over an empty class body and corrupting downstream `.d.ts` reconstruction. The `ae-forgotten-export` diagnostic is unchanged (a warning locally, CI-fatal by default, suppressible per package); it now flags a genuinely forgotten public export rather than guarding against model corruption.
