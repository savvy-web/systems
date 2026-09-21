# @savvy-web/changelog

## 1.0.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | dependency | updated | ^0.23.0 | ^0.24.0 |
| @savvy-web/silk-effects | dependency | updated | 9.0.2 | 9.1.0 |

[#681][#681]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#681]: https://github.com/savvy-web/systems/pull/681

## 1.0.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/commands | dependency | updated | ^0.7.2 | ^0.8.0 |
| @effected/git | dependency | updated | ^0.15.2 | ^0.16.0 |
| @effected/workspaces | dependency | updated | ^0.22.1 | ^0.23.0 |
| @savvy-web/silk-effects | dependency | updated | 9.0.1 | 9.0.2 |
| effect | dependency | updated | 4.0.0-rc.115 | 4.0.0-rc.116 |

[#672][#672]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#672]: https://github.com/savvy-web/systems/pull/672

## 1.0.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/commands | dependency | updated | ^0.7.1 | ^0.7.2 |
| @effected/git | dependency | updated | ^0.15.1 | ^0.15.2 |
| @effected/workspaces | dependency | updated | ^0.22.0 | ^0.22.1 |
| @savvy-web/silk-effects | dependency | updated | 9.0.0 | 9.0.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 1.0.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 8.2.1 | 9.0.0 |

## 1.0.0

### Breaking Changes

- The package is now ESM-only. The `require` export condition is gone, and the build no longer bundles its dependencies for a CommonJS consumer.

- This requires `@changesets/cli` v3 or later, which loads changelog generators via dynamic `import()` rather than `require()`. Consumers still on `@changesets/cli` 2.x will fail to load this package as their configured changelog generator.

- `@savvy-web/silk-effects`, `effect`, `@effected/commands`, `@effected/git`, and `@effected/workspaces` move from bundled devDependencies to externalized regular `dependencies` — they are resolved at install time rather than inlined into the build output.

#### Migration

- Upgrade `@changesets/cli` to v3 or later alongside this package. [#664][#664]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 8.2.0 | 8.2.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#664]: https://github.com/savvy-web/systems/pull/664

## 0.2.0

### Bug Fixes

- Force releasing all packages to fix pnpm v12 flakiness.

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 0.1.3

### Bug Fixes

- Force bumping all public packages due to npm flakiness in releasing tooling. [#651][#651]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#651]: https://github.com/savvy-web/systems/pull/651

## 0.1.2

### Maintenance

- Reads `VITEST`/`GITHUB_ACTIONS` itself and builds the changelog functions via `Changesets.makeChangelogFunctions({ logMode })`, now that `@savvy-web/silk-effects` no longer sniffs the environment. Behaviour under the changesets CLI is unchanged: `::warning::` annotations in GitHub Actions, silence under vitest, stderr otherwise. [#638][#638]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#638]: https://github.com/savvy-web/systems/pull/638

## 0.1.1

### Bug Fixes

- Default export now typed as the nominal `ChangelogFunctions` from `@changesets/types` instead of typeof-chaining through the `@savvy-web/silk-effects` namespace
- Published `index.d.ts` shrinks from \~644KB to \~2KB; the redundant per-module declarations pass and `declare module "./Effect.js"` build warnings are gone
- No runtime behavior change [#240][#240]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#240]: https://github.com/savvy-web/systems/pull/240

## 0.1.0

### Features

- ### Standalone changesets changelog generator
  `@savvy-web/changelog` ships the Silk Suite's `changesets` changelog generator as its own installable package — a thin re-export of `@savvy-web/silk-effects`'s `Changesets.changelogFunctions`, with `silk-effects` remaining the single source of truth.
  - Dual ESM + CJS output: the CJS artifact is fully self-contained (`silk-effects` inlined) so the vanilla Changesets CLI can `require()` it directly; ESM is served for the changesets v3 engine's `import()`.
  - Reference it as the `changelog` entry in `.changeset/config.json`:

  ````json
  {
    "changelog": ["@savvy-web/changelog", { "repo": "owner/repo" }]
  }
  ``` [#223](https://github.com/savvy-web/systems/pull/223) Thanks [@spencerbeggs](https://github.com/spencerbeggs)!
  ````
