# @savvy-web/pnpm-plugin-silk

`@savvy-web/pnpm-plugin-silk` is the unified pnpm **config dependency** for the Silk Suite. At `pnpm install` it injects into every consuming repo five purpose-scoped catalog pairs — `build`, `docs`, `lint`, `silk`, `test`, each with a `<name>:peers` companion carrying permissive peer ranges — plus `allowBuilds`, `publicHoistPattern`, `peerDependencyRules`, `minimumReleaseAge` gating, and the `strictDepBuilds`/`blockExoticSubdeps` defaults. The camelCase `<name>Peers` spelling is GONE (0.27.0); so is the Effect closure, which now comes from the separate `@effected/pnpm-plugin-effected` config dependency as the single `catalog:effected`.

## Key surface

- `private: true` source, `publishConfig.access: public`, **npm-registry-only** — the one repo package not also published to GitHub Packages (`publishConfig.targets: { npm: true }`).
- Built **in-tree** by `effected package build`: `effected.toml` loads `lib/build/pnpm-config.plugin.ts` through `plugins = [...]`, and that file's `PnpmConfigPlugin({...})` call (from `rolldown-pnpm-config`) is the single source of truth for the entire distributed config (catalogs, hoist/build/peer rules). `bundleNodeModules = true`; `[package.build.looseFiles]` emits `pnpmfile.mjs` from `src/pnpmfile.ts`. Keep the config a literal at the `PnpmConfigPlugin(...)` call — the upgrade CLI walks it statically.
- `src/index.ts` and `src/pnpmfile.ts` are one-line re-exports of `rolldown-pnpm-config/virtual/{catalogs,pnpmfile}` — no hand-written logic lives in `src/`.
- Self-consumption: the monorepo cannot be its own config dependency, so the config is materialized into the root `pnpm-workspace.yaml` via `pnpm pnpm:export`. Edit the config in `lib/build/pnpm-config.plugin.ts`, then run `pnpm pnpm:export` to refresh the local workspace yaml.
- Maintainer commands at repo root (proxy to `rolldown-pnpm-config`): `pnpm pnpm:up` (interactive catalog bump; runs `rolldown-pnpm-config upgrade lib/build/pnpm-config.plugin.ts`), `pnpm pnpm:preview`, `pnpm pnpm:export` (both run from `lib/build`).
- The `build` catalog holds ONLY `@types/bun`; `@tsdown/css` left it and is catalogued nowhere (not in the kit's `effected:build` either), so a consumer that needs it pins it directly. Every other build-chain/toolchain member (tsdown, rolldown, rolldown-plugin-dts, api-extractor, tsdoc, typescript, `@types/node`, tsx, react, `@rsbuild/core`, `@tsdown/exe`) comes from `@effected/pnpm-plugin-effected`'s `catalog:effected:build`; do not add one back here. The `silk` catalog (and `silk:peers`) holds only `@types/bun` — `ink` left it for the kit's `effected:build`/`effected:build:peers` (0.26.2) and the contract test now rejects it from every silk catalog; `husky`, `lint-staged`, `markdownlint-cli2` and `markdownlint-cli2-formatter-codequality` are served by `lint` alone. The `docs` and `silk` catalogs (and their `:peers`) carry no toolchain member either (typescript, tsx, `@types/node`, `@types/react`, `@types/react-dom`, react, react-dom are the kit's), and `publicHoistPattern`/`minimumReleaseAgeExclude` do not duplicate the kit's hoists or exemptions — silk peers the toolchain through `catalog:effected:build:peers`, so the kit is upstream of silk. The managed config carries NO `overrides`. Never take the `@microsoft/api-extractor@8.0.0` the update tool offers as a major — a 2019 release on TypeScript ~3.1, not a successor.
- Versions **independently** (as every package now does — `.changeset/config.json` defines no `fixed` or `linked` groups) and is **npm-registry-only**.

## Design

Load for the config-dependency model, the `rolldown-pnpm-config` plugin contract, and the self-consumption export flow:
→ `@../../okf/modules/pnpm-plugin-silk.md`
Load when editing the distributed config or the export/self-consumption pipeline.

The catalog names a consumer manifest may reference, as a consumer-side interface:
→ `@../../okf/interfaces/silk-catalogs.md`
Load when adding, renaming, or removing a catalog, or changing what the plugin hoists.
