---
"@savvy-web/silk": patch
---

## Bug Fixes

Fixed a portability error in the config-integration shims. Consumer config files that infer a factory's return type — `export default CommitlintConfig.silk()` from `@savvy-web/silk/commitlint`, or `Preset.silk()` / `Preset.minimal()` / `Preset.standard()` / `Preset.get(...)` from `@savvy-web/silk/lint` — failed to type-check under pnpm with TS2883, because the inferred type's canonical home was `@savvy-web/silk-effects`, a transitive dependency the consumer could not name. The shims now wrap these factories in silk-local facades with silk-owned return types, so consumer declaration emit is portable and no type annotation is needed. The public API is unchanged and consumers require no code changes.
