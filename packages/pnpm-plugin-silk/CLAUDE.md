# @savvy-web/pnpm-plugin-silk

`@savvy-web/pnpm-plugin-silk` is the unified pnpm **config dependency** for the Silk Suite. At `pnpm install` it injects into every consuming repo five purpose-scoped catalog pairs — `build`, `docs`, `lint`, `silk`, `test`, each with a `<name>:peers` companion carrying permissive peer ranges — plus security `overrides`, `allowBuilds`, `publicHoistPattern`, `peerDependencyRules`, `minimumReleaseAge` gating, and the `strictDepBuilds`/`blockExoticSubdeps` defaults. The camelCase `<name>Peers` spelling is GONE (0.27.0); so is the Effect closure, which now comes from the separate `@effected/pnpm-plugin-effected` config dependency as the single `catalog:effected`.

## Key surface

- `private: true` source, `publishConfig.access: public`, **npm-registry-only** — the one repo package not also published to GitHub Packages (`publishConfig.targets: { npm: true }`).
- Built **in-tree**: `savvy.build.ts` calls `@savvy-web/bundler`'s `build()` front door with `rolldown-pnpm-config`'s `PnpmConfigPlugin({...})`, so `savvy.build.ts` is the single source of truth for the entire distributed config (catalogs, overrides, hoist/build/peer rules). `bundleNodeModules: true`; `looseFiles` emits `pnpmfile.mjs` + `pnpmfile.cjs`. tsdown's "We recommend using the ESM format instead of CommonJS" warning on `pnpmfile.cjs` is EXPECTED and deliberately left visible — a config dependency must ship a CJS pnpmfile, and the warning is the reminder to drop that output. Do not suppress it.
- `src/index.ts` and `src/pnpmfile.ts` are one-line re-exports of `rolldown-pnpm-config/virtual/{catalogs,pnpmfile}` — no hand-written logic lives in `src/`.
- Self-consumption: the monorepo cannot be its own config dependency, so the config is materialized into the root `pnpm-workspace.yaml` via `pnpm pnpm:export`. Edit the config in `savvy.build.ts`, then run `pnpm pnpm:export` to refresh the local workspace yaml.
- Maintainer commands at repo root (proxy to `rolldown-pnpm-config`): `pnpm pnpm:up` (interactive catalog bump), `pnpm pnpm:preview`, `pnpm pnpm:export`.
- API Extractor needs NO override any more: from 7.60.0 `@microsoft/api-extractor` depends on TypeScript 6.0.3 itself (it previously pinned 5.9.3, and a `@microsoft/api-extractor>typescript: ^6.0.3` override forced 6 into its private graph). The override was dropped with the move to `^7.60.1`. Do NOT re-add it: once api-extractor moves to TypeScript 7 (microsoft/rushstack#6033), it would force TS6 back onto every consumer. This is independent of the workspace's own TypeScript — tsdown-plugins' declaration emit runs on the 7.1 API. The tsdoc pair stays at `~0.17.1`/`~0.18.3` (the latest releases); api-extractor 7.60.x still declares `~0.17.0`/`~0.18.2`, so one copy of each resolves. The `8.0.0` the update tool offers as a major is a 2019 release on TypeScript ~3.1, not a successor; never take it. The managed `overrides` now carry one entry: `tsdown>rolldown-plugin-dts: ^0.29.0`, which lifts tsdown 0.23.4's narrowed `^0.28.8` range back onto the 0.29 line, the first that resolves TypeScript 7.1's tsgo (0.28.8 dies with "TypeScript Go is not installed"); drop it once tsdown's own range admits 0.29.
- Versions **independently** (as every package now does — `.changeset/config.json` defines no `fixed` or `linked` groups) and is **npm-registry-only**.

## Design

Load for the config-dependency model, the `rolldown-pnpm-config` plugin contract, and the self-consumption export flow:
→ `@../../okf/modules/pnpm-plugin-silk.md`
Load when editing the distributed config or the export/self-consumption pipeline.

The catalog names a consumer manifest may reference, as a consumer-side interface:
→ `@../../okf/interfaces/silk-catalogs.md`
Load when adding, renaming, or removing a catalog, or changing what the plugin hoists.
