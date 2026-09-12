# @savvy-web/changelog

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
