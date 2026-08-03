---
"@savvy-web/bundler": patch
---

## Refactoring

* Internal layer usage in `runBuild` and the package's own self-hosting `savvy.build.ts` updated to consume `@savvy-web/tsdown-plugins`'s renamed statics — `ConfigValidator.layer` in place of the removed `ConfigValidatorLive`, and `ReportPipeline` in place of the removed `ReportPipelineLive`. No change to `runBuild`, `defineBuild`, or the package's own build output.
