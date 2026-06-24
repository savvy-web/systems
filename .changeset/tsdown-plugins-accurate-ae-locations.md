---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Accurate `file`/`line`/`column` on API Extractor diagnostics

`ae-*` and `tsdoc-*` diagnostics in `dist/prod/issues.json` now carry accurate `file`, `line`, and `column` fields pointing at the true source declaration.

The meta pass previously analyzed only the bundled `.d.ts`, whose source-map positions anchor to the start of an adjacent declaration rather than the symbol itself. The workaround (systems#154) dropped location fields entirely. This release replaces that workaround: the prod meta pass now runs API Extractor a second time over a per-module declaration tree (`dist/prod/<id>/declarations/`) where each `.d.ts.map` references only its own source file, so positions resolve correctly.

The bundled api-model (consumed by RSPress / API-doc rendering) is unchanged — it is still produced from the bundled `.d.ts`.

**Consumer-visible side effects:**

- A new `dist/prod/<id>/declarations/` artifact tree is emitted during prod builds. It is kept locally but not published to npm.
- The prod meta pass now runs API Extractor twice, adding a fixed-overhead build step.
- For Effect `Data.TaggedError` / service classes built from a synthesized `_base` declaration, rolldown-plugin-dts does not source-map the `_base` synthesis, so those diagnostics may report a path inside `declarations/*.d.ts` rather than the original `src/*.ts`. Use the symbol name quoted in the diagnostic `text` to locate the declaration in source.

### New public option fields

Three new additive options are available for advanced use cases:

- `BuildTargetGroupsOptions.emitDeclarations` — controls whether the build loop emits the per-module declaration tree (default: `false` for `dev`, `true` for `prod`)
- `RunApiExtractorOptions.emitDocModel` — controls whether the API Extractor pass writes its `.api.json` model (default: `true`)
- `GenerateMetaOptions.aeInputDir` — overrides the directory that the meta pass's diagnostics-only run reads declarations from

## Reverts

Reverts the systems#154 mitigation that suppressed `file`/`line`/`column` from API Extractor diagnostics. Consumers who adapted tooling to the absent-location behavior should revert those workarounds.
