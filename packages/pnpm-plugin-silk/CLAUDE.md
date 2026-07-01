# @savvy-web/pnpm-plugin-silk

`@savvy-web/pnpm-plugin-silk` is the unified pnpm **config dependency** for the Silk Suite. At `pnpm install` it injects into every consuming repo the `silk` (current ranges) and `silkPeers` (permissive peer ranges) catalogs, security `overrides`, `allowBuilds`, `publicHoistPattern`, `peerDependencyRules`, `minimumReleaseAge` gating, and the `strictDepBuilds`/`blockExoticSubdeps` defaults.

## Key surface

- `private: true` source, `publishConfig.access: public`, **npm-registry-only** — the one repo package not also published to GitHub Packages (`publishConfig.targets: { npm: true }`).
- Built **in-tree**: `savvy.build.ts` calls `@savvy-web/bundler`'s `build()` front door with `rolldown-pnpm-config`'s `PnpmConfigPlugin({...})`, so `savvy.build.ts` is the single source of truth for the entire distributed config (catalogs, overrides, hoist/build/peer rules). `bundleNodeModules: true`; `looseFiles` emits `pnpmfile.mjs` + `pnpmfile.cjs`.
- `src/index.ts` and `src/pnpmfile.ts` are one-line re-exports of `rolldown-pnpm-config/virtual/{catalogs,pnpmfile}` — no hand-written logic lives in `src/`.
- Self-consumption: the monorepo cannot be its own config dependency, so the config is materialized into the root `pnpm-workspace.yaml` via `pnpm pnpm:export`. Edit the config in `savvy.build.ts`, then run `pnpm pnpm:export` to refresh the local workspace yaml.
- Maintainer commands at repo root (proxy to `rolldown-pnpm-config`): `pnpm pnpm:up` (interactive catalog bump), `pnpm pnpm:preview`, `pnpm pnpm:export`.
- Versions **independently** (as every package now does — `.changeset/config.json` defines no `fixed` or `linked` groups) and is **npm-registry-only**.

## Design

Load for the config-dependency model, the `rolldown-pnpm-config` plugin contract, catalog/strategy semantics, and the self-consumption export flow:
→ `@../../.claude/design/pnpm-plugin-silk/architecture.md`
Load when editing the distributed config, the catalogs, or the export/self-consumption pipeline.
