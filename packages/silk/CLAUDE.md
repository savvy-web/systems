# @savvy-web/silk

`@savvy-web/silk` is the single install-target of thin config-integration shims plus the Biome asset, AND the carrier (L4, top of the package graph) for the `savvy` / `savvy-mcp` bins. Built via `@savvy-web/bundler`.

silk is "carrier + config shims", not a pure carrier: nine files under `src/` import `@savvy-web/silk-effects`, so silk-effects is a genuine runtime `dependencies` entry — the build no longer sources it from `devDependencies`.

## Key surface

- Export map covers `./changesets` (+ `/changelog`, `/markdownlint`, `/remark`), `./commitlint` (+ `/static`, `/prompt`, `/formatter`), `./lint`, `./biome`, and the `./tsconfig/*` presets.
- Carrier bins: `bin.savvy` → `src/bin/savvy.ts` and `bin["savvy-mcp"]` → `src/bin/savvy-mcp.ts`, shims over `@savvy-web/cli/main` and `@savvy-web/mcp/main` (each imports `main` and calls it, nothing else). Installing silk alone creates `node_modules/.bin/savvy` and `.bin/savvy-mcp` off that single direct dependency, no hoisting. The built shims keep the literal import specifiers (cli/mcp are declared deps, so tsdown externalizes them); `__test__/externals.test.ts` pins the built `bin` map and each shim's single import, `__test__/e2e/bins.e2e.test.ts` runs the built bins.
- ESM-only for every entry EXCEPT two per-entry build overrides in `savvy.build.ts` that ship dual-format CJS and force-bundle `@savvy-web/silk-effects` plus its transitive deps: `./changesets/changelog` (the Changesets CLI `require()`s the formatter via `resolve-from`) and `./changesets/markdownlint` (markdownlint-cli2 `require()`s it). Because silk-effects is a DECLARED dependency, tsdown auto-externalizes it even under `bundleNodeModules`; the overrides carry `bundle: ["@savvy-web/silk-effects"]` (tsdown `deps.alwaysBundle`), which `@savvy-web/tsdown-plugins`' `buildTargetGroups` forwards to the dts and prod-only declarations passes identically to the JS pass, so the re-emitted dual-format `.cjs` chunk stays inlined too — no importer-gated `resolveId` workaround. `externals.test.ts` asserts no `.cjs` contains `require("@savvy-web/silk-effects")`.
- Base ESM entries externalize `@savvy-web/silk-effects` (a declared runtime dependency), `semver`, and `source-map-support`; `effect`/`@effect/platform` are externalized in the dts only.
- The changesets surface targets changesets v3: `@changesets/cli` is a `^3` peer, matching silk-effects' v3-engine `Changesets` namespace (breaking for v2 consumers).
- Silk-local facades wrap the `CommitlintConfig`/`Preset` factories so consumer configs emit portable `.d.ts` (type-portability invariant).
- `@effected/templates` is a direct runtime dependency: the `./lint` entry's declarations name kit `Section`/`SectionId` types, so it must ALSO stay on `savvy.build.ts`'s published-manifest keep-list. Any package whose emitted `.d.ts` references a type must ship that package as a real dependency — dropping it from the keep-list breaks consumer typecheck under pnpm's strict layout.
- Ships `@savvy-web/changelog`, `@savvy-web/cli`, and `@savvy-web/mcp` as EXACT-pinned regular `dependencies`: source `workspace:*` resolves to the exact version at publish, with no transform promotion to peers — publishing them as peers made pnpm `autoInstallPeers` propagate their Effect graph into consumers at wrong versions. The bins reach a consumer through silk's OWN `bin` map (the carrier shims above), not through hoisting: `@savvy-web/pnpm-plugin-silk` no longer hoists cli/mcp — only `@savvy-web/changelog`, which the changesets engine resolves by id from the consumer root (see root CLAUDE.md Conventions for the versioning coupling). `@e2e/silk` proves the bins from a packed install outside the workspace.
- Load-bearing dependencies (systems#631): `@savvy-web/silk-effects` (nine `src/` importers), `@savvy-web/cli` and `@savvy-web/mcp` (the shim import targets), everything on the `savvy.build.ts` keep-list, AND `@effected/commands`, `@effected/git`, `@effected/workspaces`, `effect` — no file under `src/` imports those four directly; they satisfy `@savvy-web/silk-effects`' `peerDependencies`, and removing one breaks installs at install time, not at any lint pass. The non-import invariant still holds for library code: `src/bin/savvy.ts` and `src/bin/savvy-mcp.ts` are the ONE sanctioned place silk imports `@savvy-web/cli` / `@savvy-web/mcp`; nothing else under `src/` may.
- The Biome asset lives under top-level `public/`.

## Peer audit (systems#631)

Every `peerDependencies` entry is a tool the consumer runs itself (its own hooks, typecheck, test, lint or build invocations), not a delivery mechanism silk merely carries — so none moved to `dependencies`. Audited "yes" for all eighteen: `@biomejs/biome`, `@changesets/cli`, `@commitlint/cli`, `@commitlint/config-conventional`, `@types/bun`, `@types/node`, `@vitest/coverage-istanbul`, `@vitest/coverage-v8`, `@vitest/expect`, `husky`, `lint-staged`, `markdownlint-cli2`, `markdownlint-cli2-formatter-codequality`, `tsx`, `turbo`, `typescript`, `vite`, `vitest`. Ask the same question before adding a peer; a "no" means `dependencies`.

## Biome version upgrade

Biome is pinned EXACTLY, never to a range. `package.json` `peerDependencies["@biomejs/biome"]` is `catalog:lint`, and the catalog entry carries a bare exact version, so the published manifest ships an exact peer (verify with the built `dist/prod/npm/pkg/package.json`). Six coupled spots — bump all six together when upgrading:

1. `packages/pnpm-plugin-silk/savvy.build.ts`, the `@biomejs/biome` entry in the `lint` catalog (`range` AND `peer`) → the exact new release (e.g. `2.5.9`). This is the SOURCE OF TRUTH for every catalog, here and in all ~33 consumer repos. The root `pnpm-workspace.yaml` is GENERATED from it — a hand edit there looks correct, is silently reverted by the next `pnpm pnpm:export`, and consumers keep resolving the old version from the published config dependency; nothing in CI verifies the export. A catalog change also needs its own `@savvy-web/pnpm-plugin-silk` changeset, or the fix never leaves this repo.
2. Root `pnpm-workspace.yaml`, BOTH the `lint` and `lint:peers` catalogs → refresh by running `pnpm pnpm:export` (then `pnpm exec savvy lint fmt pnpm-workspace`, since the exporter's quoting differs from the committed form). Do not type the version in by hand.
3. `public/biome/silk.json` `$schema` URL → the same exact release.
4. Root `biome.jsonc` `$schema` URL → the same exact release.
5. `@savvy-web/cli`'s `BIOME_VERSION` const (`packages/cli/src/commands/lint/biome-version.ts`) → the same exact release; `savvy init`/`savvy check` sync consumer `biome.json(c)` `$schema` URLs to it.
6. `@savvy-web/templates`' `biomeVersion` schema default (`packages/templates/src/lib/workspace/index.ts`) → the same exact release; it feeds the `$schema` URL of every scaffolded `biome.jsonc`, and its test asserts the URL literally.

The URL sites and `BIOME_VERSION` have drifted from the installed binary before (2.5.1 everywhere while the catalog installed 2.5.0). Nothing checks them for agreement, so grep the old version across the repo after bumping — `savvy.build.ts` is the entry that gets missed, because the generated yaml already shows the new number.

Config keys in the shared `public/biome/silk.json` asset are a separate concern: the asset propagates to ~33 consumer repos, so a key unknown to the OLDEST Biome any consumer still runs makes that consumer hard-error. Check the key against the older schema before adding it (`curl https://biomejs.dev/schemas/<old>/schema.json`). Known 2.5-only keys, still ungated: `linter.rules.preset`, `javascript.resolver`, `formatter.delimiterSpacing`, `html.parser.vue`, `plugins[].includes`.

## Design

Load for the shim contract, export map, peerDep wiring, and the type-portability invariant:
→ `@../../.claude/design/silk/architecture.md`
Load when adding a shim entry, changing the export map, or debugging consumer typecheck (TS2883/TS2320).
