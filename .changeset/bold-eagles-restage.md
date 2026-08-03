---
"@savvy-web/github-action-builder": minor
---

## Breaking Changes

### Layer statics replace `XLive` exports

`ConfigServiceLive`, `ValidationServiceLive`, `BuildServiceLive`, and `PersistLocalServiceLive` are removed, along with the four standalone module files that defined them. Each service's production layer now lives as a `.layer` static on its own class. The package's higher-level `ConfigLayer`, `ValidationLayer`, `BuildLayer`, `PersistLocalLayer`, and `AppLayer` composites are unaffected — only the lower-level per-service layer names change for anyone consuming them directly.

```typescript
// Before
import { ConfigServiceLive } from "@savvy-web/github-action-builder";
Effect.provide(ConfigServiceLive);

// After
import { ConfigService } from "@savvy-web/github-action-builder";
Effect.provide(ConfigService.layer);
```

This is a genuine breaking change to the package's export surface, released as a minor bump rather than a major: consumption of `@savvy-web/github-action-builder` is effectively in-house across the Silk Suite, so the migration cost is contained and immediate.
