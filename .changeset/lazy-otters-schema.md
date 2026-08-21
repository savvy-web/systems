---
"@savvy-web/silk": minor
---

## Features

### Schema validation coverage

Expands schema-driven JSON validation coverage in the published Biome preset (`silk.jsonc`) to more of the repo's own config files, so editors and CI get schema-aware linting on them too:

* `.claude/settings.json` / `.claude/settings.local.json`
* `.claude/design/design.config.json`
* `.changeset/config.json`
* `**/.markdownlint.json` and `**/.markdownlint-cli2.jsonc`
* `**/devcontainer.json`
* `.repos/config.json`
* `.vscode/*.json`
* `**/biome.json` / `**/biome.jsonc` / `**/silk.jsonc`
* `**/.claude-plugin/plugin.json` and `**/.claude-plugin/marketplace.json`

### Catalog-aware module resolution

`javascript.resolver.experimentalPnpmCatalogs` is now enabled in the preset. Biome resolves `catalog:` and `catalog:<name>` dependency specs from `package.json`, so dependency-aware rules understand a workspace that keeps its versions in pnpm catalogs instead of treating those specs as unresolvable.

## Maintenance

**This preset now requires Biome 2.5 or newer.** `linter.rules.preset` and `javascript.resolver` do not exist in 2.4.x, and Biome rejects unknown configuration keys outright rather than ignoring them, so a repo on 2.4.x must upgrade before taking this release. `savvy init` and the release pipeline move consumers onto the pinned version.

* `linter.rules.recommended: true` migrated to `linter.rules.preset: "recommended"`, which replaces it as of Biome 2.5. Lint behavior is unchanged.
* The `$schema` URL moves to 2.5.9 — the version CI reads to install the Biome binary.
