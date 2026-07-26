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

Biome's version is hand-pinned in three coupled spots — bump all three together when upgrading:

1. `public/biome/silk.jsonc` `$schema` URL → the exact new release (e.g. `2.5.1`).
2. `package.json` `peerDependencies["@biomejs/biome"]` → the new minor line (e.g. `~2.5.0`), kept optional.
3. `@savvy-web/cli`'s `BIOME_VERSION` const (`packages/cli/src/commands/lint/biome-version.ts`) → the exact new release; `savvy init`/`savvy check` sync consumer `biome.json(c)` `$schema` URLs to it.

## Design

Load for the shim contract, export map, peerDep wiring, and the type-portability invariant:
→ `@../../.claude/design/silk/architecture.md`
Load when adding a shim entry, changing the export map, or debugging consumer typecheck (TS2883/TS2320).
