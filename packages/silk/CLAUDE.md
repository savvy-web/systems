# @savvy-web/silk

`@savvy-web/silk` is the single install-target of thin config-integration shims plus the Biome asset. Built via `@savvy-web/bundler`.

## Key surface

- Export map covers `./changesets` (+ `/changelog`, `/markdownlint`, `/remark`), `./commitlint` (+ `/static`, `/prompt`, `/formatter`), `./lint`, `./biome`, and the `./tsconfig/*` presets.
- ESM-only for every entry EXCEPT `./changesets/markdownlint`, which ships dual-format CJS (markdownlint-cli2 `require()`s it) via a per-entry build override that force-bundles `@savvy-web/silk-effects` and its transitive deps.
- Base ESM entries externalize `@savvy-web/silk-effects` (a published runtime dependency), `semver`, and `source-map-support`; `effect`/`@effect/platform` are externalized in the dts only.
- The changesets surface targets changesets v3: `@changesets/cli` is a `^3` peer, matching silk-effects' v3-engine `Changesets` namespace (breaking for v2 consumers).
- Silk-local facades wrap the `CommitlintConfig`/`Preset` factories so consumer configs emit portable `.d.ts` (the type-portability invariant).
- `@effected/templates` is a direct runtime dependency: the `./lint` entry's declarations name kit `Section`/`SectionId` types, so it must ALSO stay on `savvy.build.ts`'s published-manifest keep-list. Any package whose emitted `.d.ts` references a type must ship that package as a real dependency — dropping it from the keep-list breaks consumer typecheck under pnpm's strict layout.
- Ships `@savvy-web/changelog`, `@savvy-web/cli`, and `@savvy-web/mcp` as EXACT-pinned regular `dependencies`: source `workspace:*` resolves to the exact version at publish, with no transform promotion to peers — publishing them as peers made pnpm `autoInstallPeers` propagate their Effect graph into consumers at wrong versions; `@savvy-web/pnpm-plugin-silk` publicly hoists all three so bins stay available (see root CLAUDE.md Conventions for the versioning coupling).
- Depends only on `@savvy-web/silk-effects` within the repo; must NOT import `@savvy-web/cli` or `@savvy-web/mcp`.
- The Biome asset lives under top-level `public/`.

## Biome version upgrade

Biome is pinned EXACTLY, never to a range. `package.json` `peerDependencies["@biomejs/biome"]` is `catalog:lint`, and the catalog entry carries a bare exact version, so the published manifest ships an exact peer (verify with the built `dist/prod/npm/pkg/package.json`). Six coupled spots — bump all six together when upgrading:

1. `packages/pnpm-plugin-silk/savvy.build.ts`, the `@biomejs/biome` entry in the `lint` catalog (`range` AND `peer`) → the exact new release (e.g. `2.5.9`). This is the SOURCE OF TRUTH for every catalog, here and in all ~33 consumer repos. The root `pnpm-workspace.yaml` is GENERATED from it — editing that file by hand looks correct and is silently reverted the next time anyone runs `pnpm pnpm:export`, while consumers keep resolving the old version from the published config dependency. Nothing in CI regenerates or verifies the export, so that drift lands unnoticed. A catalog change also needs its own `@savvy-web/pnpm-plugin-silk` changeset, or the fix never leaves this repo.
2. Root `pnpm-workspace.yaml`, BOTH the `lint` and `lint:peers` catalogs → refresh by running `pnpm pnpm:export` (then `pnpm exec savvy lint fmt pnpm-workspace`, since the exporter's quoting differs from the committed form). Do not type the version in by hand.
3. `public/biome/silk.jsonc` `$schema` URL → the same exact release.
4. Root `biome.jsonc` `$schema` URL → the same exact release.
5. `@savvy-web/cli`'s `BIOME_VERSION` const (`packages/cli/src/commands/lint/biome-version.ts`) → the same exact release; `savvy init`/`savvy check` sync consumer `biome.json(c)` `$schema` URLs to it.
6. `@savvy-web/templates`' `biomeVersion` schema default (`packages/templates/src/lib/workspace/index.ts`) → the same exact release; it feeds the `$schema` URL of every scaffolded `biome.jsonc`, and its test asserts the URL literally.

The URL sites and `BIOME_VERSION` have drifted from the installed binary before (2.5.1 everywhere while the catalog installed 2.5.0). Nothing checks the five for agreement, so grep the old version across the repo after bumping — `savvy.build.ts` is the entry that gets missed, because the generated yaml already shows the new number.

Config keys in the shared `public/biome/silk.jsonc` asset are a separate concern from the version pin: the asset propagates to ~33 consumer repos, so a key that does not exist in the OLDEST Biome any consumer still runs makes that consumer hard-error on an unknown key. Check the key against the older schema before adding it (`curl https://biomejs.dev/schemas/<old>/schema.json`). Known 2.5-only keys, still ungated: `linter.rules.preset`, `javascript.resolver`, `formatter.delimiterSpacing`, `html.parser.vue`, `plugins[].includes`.

## Design

Load for the shim contract, export map, peerDep wiring, and the type-portability invariant:
→ `@../../.claude/design/silk/architecture.md`
Load when adding a shim entry, changing the export map, or debugging consumer typecheck (TS2883/TS2320).
