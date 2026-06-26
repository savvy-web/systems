---
id: packages/tsdown-plugins/api/function/resolvemanifest
title: "resolveManifest — tsdown-plugins function"
summary: "Resolve every `catalog:`/`workspace:` specifier in a manifest to a concrete spec, delegating to workspaces-effect's CatalogResolver. The resolver discovers the…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# resolveManifest

Resolve every `catalog:`/`workspace:` specifier in a manifest to a concrete spec, delegating to workspaces-effect's CatalogResolver. The resolver discovers the workspace root from `process.cwd()` (run this from inside the target workspace) and assembles catalogs durably (inline + config-dependency hook-replay + lockfile), so no transient `.pnpm-workspace-state-v1.json` is required. Rejects with `CatalogResolutionError` on an unresolvable reference, or `CatalogAssemblyError` if the workspace catalog set cannot be assembled.

```ts
function resolveManifest(pkg: ManifestLike$1): Promise<ManifestLike$1>;
```
