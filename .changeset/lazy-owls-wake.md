---
"@savvy-web/silk-effects": minor
---

## Features

### `Lint.POST_COMMIT_HOOK_PATH` export (#122)

A new constant `Lint.POST_COMMIT_HOOK_PATH` is exported from the `Lint` namespace, resolving to `.husky/post-commit`. It holds the conventional path for the savvy-hooks post-commit hygiene script so callers that create or inspect the hook do not need to hard-code the path themselves.

### `ConfigInspector` augments explicit `packages` records (#127)

`Changesets.ConfigInspector` now **augments** an explicit `.changeset/config.json` `packages` record with the remaining release-surface workspace packages detected via `SilkPublishability`, rather than treating the record as a closed allow-list.

Previously, a `packages` record that existed only to annotate one package's `versionFiles` caused every other workspace package to be classified as unmapped during branch analysis. With this fix, all publishable workspace packages appear in the attribution map; packages whose annotation (`additionalScopes`, `versionFiles`, etc.) comes entirely from the config record retain their annotation, while unannotated packages are added with default attribution.

### Markdownlint template ignores test-fixture directories (#123)

The generated `.markdownlint-cli2.jsonc` template now adds `**/__test__/**/fixtures/**` and `**/__fixtures__/**` to its `ignores` list. This brings the markdownlint handler into parity with the Yaml, Biome, and PackageJson handlers, which already excluded these paths.

The template's `MD025` rule is now configured as `{ "front_matter_title": "" }` (previously `true`), matching the `MD024: { "siblings_only": true }` rule it already carried. A regenerated config now allows sibling duplicate headings and treats front-matter titles as `H1`s consistently.
