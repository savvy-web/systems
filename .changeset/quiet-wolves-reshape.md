---
"@savvy-web/tsdown-plugins": minor
---

## Breaking Changes

### Layer statics replace `XLive` exports

`ConfigValidatorLive`, `EnvironmentDetectorLive`, `ExecutorResolverLive`, `FormatSelectorLive`, and `OutputRendererLive` are removed. Each now lives as a `.layer` static on its own service class, and the five standalone module files that defined them are deleted.

```typescript
// Before
import { ConfigValidatorLive } from "@savvy-web/tsdown-plugins";
Effect.provide(ConfigValidatorLive);

// After
import { ConfigValidator } from "@savvy-web/tsdown-plugins";
Effect.provide(ConfigValidator.layer);
```

`ReportPipelineLive` is renamed to `ReportPipeline` — it composes multiple services via `Layer.mergeAll` rather than belonging to one, so it has no owning class to attach a static to.

```typescript
// Before
import { ReportPipelineLive, renderReport } from "@savvy-web/tsdown-plugins";
renderReport(reports, options).pipe(Effect.provide(ReportPipelineLive));

// After
import { ReportPipeline, renderReport } from "@savvy-web/tsdown-plugins";
renderReport(reports, options).pipe(Effect.provide(ReportPipeline));
```

This is a genuine breaking change to the package's export surface, released as a minor bump rather than a major: consumption of `@savvy-web/tsdown-plugins` is effectively in-house across the Silk Suite, so the migration cost is contained and immediate.

## Tests

* The ci-annotations report pipeline test previously used a fixture with no diagnostics, so the formatter's empty-array output satisfied the assertion's first disjunct unconditionally — the CI-annotation rendering path was never actually exercised. The fixture now carries a warning and an error, and the assertion checks the rendered `::warning`/`::error` annotation content directly.
