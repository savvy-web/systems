# @savvy-web/changelog

## 0.1.0

### Features

* ### Standalone changesets changelog generator

  `@savvy-web/changelog` ships the Silk Suite's `changesets` changelog generator as its own installable package — a thin re-export of `@savvy-web/silk-effects`'s `Changesets.changelogFunctions`, with `silk-effects` remaining the single source of truth.

  * Dual ESM + CJS output: the CJS artifact is fully self-contained (`silk-effects` inlined) so the vanilla Changesets CLI can `require()` it directly; ESM is served for the changesets v3 engine's `import()`.
  * Reference it as the `changelog` entry in `.changeset/config.json`:

  ````json
  {
    "changelog": ["@savvy-web/changelog", { "repo": "owner/repo" }]
  }
  ``` [#223](https://github.com/savvy-web/systems/pull/223) Thanks [@spencerbeggs](https://github.com/spencerbeggs)!
  ````
