---
"@savvy-web/pnpm-plugin-silk": patch
---

## Bug Fixes

The `catalog:silk` and `catalog:silkPeers` `typescript` entries move from `^6.0.3`/`^6.0.0` to `^7.0.2`/`^7.0.0`, so every consumer picks up TypeScript 7 on install. `@microsoft/api-extractor` pins TypeScript `~5.9` and has no stable compiler API until TypeScript 7.1, so a new managed override pins its `typescript` resolution to `^6.0.3`:

```json
"overrides": {
	"@microsoft/api-extractor>typescript": "^6.0.3"
}
```

The TypeScript 5 and 6 compiler APIs are equivalent for API Extractor's purposes, so this keeps API model generation working while the rest of the ecosystem moves to TypeScript 7. `@savvy-web/tsdown-plugins` similarly keeps its own `typescript` dependency locked at `^6.0.3` for the same reason.