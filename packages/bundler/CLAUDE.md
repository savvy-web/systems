# @savvy-web/bundler

`@savvy-web/bundler` is the tsdown-based build orchestrator for the Silk Suite — the `defineBuild`/`runBuild` front door and the self-executing `savvy.build.ts` contract. Drives tsdown programmatically over `@savvy-web/tsdown-plugins`.

## Key surface

- `defineBuild`/`runBuild` orchestrator; `runBuild` runs the `ConfigValidator` service first to fast-fail on bad config across dev/prod/exe.
- Catalog/`workspace:` resolution delegated to `workspaces-effect`'s `CatalogResolver`.
- `--target prod` derives byte-variant groups from the Record-map `publishConfig.targets`, writes the `dist/prod/targets.json` binding, and runs `generateMeta` per group (emitting a `meta/` release asset + `meta.localPaths`, with `meta.optimistic` next-version forward-looking).
- `--target exe` SEA-compiles via `runExeBuild` (`@tsdown/exe` is a runtime dep).
- `defineBuild` options include `format` (`BuildFormat`, default esm-only), `jsx`, `bundle`, `overrides` (per-entry format+bundling partitions), `define`, `looseFiles`, and `bundleNodeModules`. `defaultManifestTransform` is the default `transform`; `minify` defaults false and prod-only.
- Bundled, self-contained `.d.ts` per public entry is the default; JS stays per-module.
- `runBuild` threads a `BuildCollector` through the build/meta/exe phases and renders ONE unified build log from its snapshot — quiet by default (one line per target group), `--verbose` for a per-file table — surfacing collected diagnostics before a failure rethrows. On dev/prod it also writes `dist/<target>/issues.json` via the injectable `writeIssues` hook (defaults to tsdown-plugins' `writeIssuesArtifact`), the structured counterpart of the rendered log.
- Ships `@savvy-web/bundler/ecma.json`, the shared TS base config.
- Self-hosts (built by its own escape-hatch `savvy.build.ts`); versions independently from `tsdown-plugins`.

## Design

Load for the orchestrator→tsdown boundary, the TargetGroup model, dist layout, and the full option set:
→ `@../../.claude/design/bundler/architecture.md`
Load when changing build orchestration, the `defineBuild` surface, meta/targets wiring, or the `savvy.build.ts` contract.
