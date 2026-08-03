---
"@savvy-web/silk-effects": patch
---

## Documentation

Corrects stale `Context.Tag` references left over from the v4 migration to `Context.Service`, verified against the current source:

* `docs/04-changeset-config.md` — the `ChangesetConfigReader` and `ChangesetConfig` service code blocks now show the real `Context.Service<Self, Shape>()("<id>")` form, each with its companion `*Shape` interface.
* `docs/05-config-discovery.md` — the `ConfigDiscovery` service code block, same correction.
* `docs/06-biome-sync.md` — the `BiomeSchemaSync` service code block, same correction.
* `src/changesets/services/changelog.ts` — the module's TSDoc comment, which reaches the published API docs, now says `Context.Service` rather than `Context.Tag`.
