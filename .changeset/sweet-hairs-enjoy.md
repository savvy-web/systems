---
"@savvy-web/pnpm-plugin-silk": minor
---

## Breaking Changes

### The `silk` catalog no longer carries the Effect closure or the toolchain packages

`silk` and `silk:peers` drop from 63 entries to 13. The catalog now holds only
what has no more specific home — type packages, `husky`, `lint-staged`,
`markdownlint-cli2`, `react`, `react-dom`, `tsx` and `typescript`. A manifest
referencing a moved package through `catalog:silk` will fail to resolve.

**37 Effect-family entries** — `effect` and every `@effect/*` package — are gone
from this plugin entirely. They are supplied by `@effected/pnpm-plugin-effect`
instead, which must be installed as a config dependency alongside this one:

```jsonc
{
  "dependencies": {
    // before
    "effect": "catalog:silk",
    "@effect/platform-node": "catalog:silk",
    // after — from @effected/pnpm-plugin-effect
    "effect": "catalog:effect",
    "@effect/platform-node": "catalog:effect"
  }
}
```

**13 toolchain entries** move to the purpose-specific catalogs this plugin
already ships:

| Package | Was | Now |
| :--- | :--- | :--- |
| `@rsbuild/core`, `@tsdown/css`, `@tsdown/exe`, `rolldown`, `tsdown` | `catalog:silk` | `catalog:build` |
| `@changesets/cli`, `@commitlint/cli`, `@commitlint/config-conventional`, `turbo` | `catalog:silk` | `catalog:lint` |
| `vitest`, `@vitest/coverage-istanbul`, `@vitest/coverage-v8` | `catalog:silk` | `catalog:test` |
| `@rspress/core` | `catalog:silk` | `catalog:docs` |

The peer-range equivalents move the same way — `catalog:silk:peers` becomes
`catalog:build:peers`, `catalog:lint:peers`, and so on.

### The `<name>Peers` catalogs are removed — use `<name>:peers`

Peer-range catalogs are named with a `:peers` suffix instead of a `Peers`
camelCase suffix. The old spellings are gone, not deprecated:

| Removed | Replacement |
| :--- | :--- |
| `catalog:buildPeers` | `catalog:build:peers` |
| `catalog:docsPeers` | `catalog:docs:peers` |
| `catalog:lintPeers` | `catalog:lint:peers` |
| `catalog:silkPeers` | `catalog:silk:peers` |
| `catalog:testPeers` | `catalog:test:peers` |

Both spellings resolved during the transition; this release drops the old one so
a single naming convention holds across every catalog the plugin distributes. A
repo-wide sweep is safe, since the removed names no longer resolve to anything:

```bash
grep -rl 'catalog:[a-z]*Peers' --include=package.json . \
  | xargs sed -i '' -E 's/catalog:([a-z]+)Peers/catalog:\1:peers/g'
```

The rename comes from upgrading the underlying `rolldown-pnpm-config` to
`0.6.0`, which emits the colon-delimited form.

## Documentation

* The README now documents all five catalog pairs in one table, and states
  explicitly that `effect` and `@effect/*` come from
  `@effected/pnpm-plugin-effect` rather than from this plugin
* Quick-start examples source each dependency from its purpose-scoped catalog
  (`catalog:build`, `catalog:test`) instead of the old catch-all `catalog:silk`
