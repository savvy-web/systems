# @savvy-web/changelog

`@savvy-web/changelog` is the Silk Suite changesets changelog generator as a standalone installable package — the canonical `changelog` id for `.changeset/config.json`. Built via `@savvy-web/bundler`.

## Key surface

- The entire source is `src/index.ts`: a default export of `@savvy-web/silk-effects`' `Changesets.changelogFunctions`, typed against that surface so the two cannot drift. No business logic lives here — changing changelog behavior never touches this package.
- ESM-only: `savvy.build.ts` is a bare `build({ meta: false })` — no CJS twin, no `bundleNodeModules`, no resolver plugins — because `@changesets/cli` v3 is `"type": "module"` and `import()`s the changelog module.
- `@savvy-web/silk-effects`, `effect`, and `@effected/{commands,git,workspaces}` are declared runtime `dependencies`, externalized by the build and resolved by the consumer at import time. Nothing is inlined, and nothing else is declared — `jju`/`semver` were only needed while silk-effects' `@changesets/*` tree was bundled here.
- Distribution: `@savvy-web/silk` ships it as an EXACT-pinned regular `dependency` (a pure carrier edge — nothing in silk imports it), `@savvy-web/pnpm-plugin-silk` public-hoists it in consumer repos (excluded inside this repo, where the root `workspace:*` devDependency links the built `dist/dev/pkg`; a hoist would symlink the raw source tree instead — see `okf/gotchas/hoisted-workspace-package-resolves-source.md`), and `savvy init` writes it as the canonical changelog id.
- Versions independently; a release auto-PATCH-bumps `@savvy-web/silk`, which re-pins the exact dependency.

## Design

Load for the build posture, distribution/coupling map, and rationale:
→ `@../../okf/modules/changelog.md`
Load when changing the build config, the distribution wiring, or the default-export contract.

The hoist-vs-root-link trap that makes a source-tree resolution look like a working build:
→ `@../../okf/gotchas/hoisted-workspace-package-resolves-source.md`
Load before touching the root `@savvy-web/changelog` devDependency or the `excludeByRepo` hoist entry.
