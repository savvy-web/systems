# @savvy-web/changelog

`@savvy-web/changelog` is the Silk Suite changesets changelog generator as a standalone installable package — the canonical `changelog` id for `.changeset/config.json`. Built via `@savvy-web/bundler`.

## Key surface

- The entire source is `src/index.ts`: a default export of `@savvy-web/silk-effects`' `Changesets.changelogFunctions`, typed against that surface so the two cannot drift. No business logic lives here — changing changelog behavior never touches this package.
- Dual esm+cjs, self-contained via `bundleNodeModules: true` (the vanilla changesets CLI `require()`s the formatter, and CJS cannot `require()` ESM-only silk-effects). `jju`/`semver` are externalized runtime `dependencies` (circular internal CJS requires crash rolldown's interop when inlined); a `jsonc-parser` resolveId plugin steers to its ESM build. The comment headers in `savvy.build.ts` document each decision.
- `@savvy-web/silk-effects` is a bundled devDependency — the only in-repo dependency, consistent with the suite topology around silk-effects as the shared core.
- Distribution: `@savvy-web/silk` ships it as an EXACT-pinned peer companion (same mechanism as cli/mcp), `@savvy-web/pnpm-plugin-silk` public-hoists it in consumer repos (excluded inside this repo, where it is a workspace package), and `savvy init` writes it as the canonical changelog id.
- Versions independently; a release auto-PATCH-bumps `@savvy-web/silk`, which re-pins the exact peer.

## Design

Load for the build posture, distribution/coupling map, and rationale:
→ `@../../.claude/design/changelog/architecture.md`
Load when changing the build config, the distribution wiring, or the default-export contract.
