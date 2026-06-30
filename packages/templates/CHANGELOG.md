# @savvy-web/templates

## 0.1.5

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so the package picks up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds a `LICENSE` file and minor `tsconfig.json` corrections. No runtime behavior changes.

## 0.1.4

### Documentation

* [`81f90f3`](https://github.com/savvy-web/systems/commit/81f90f3e6acc11c0b70be856c676292578fdc7c2) Added `@public` release tags to all public-surface exports across the templates library (`BiomeOptions`, `ChangesetOptions`, `GitignoreOptions`, `PackageJsonOptions`, `PnpmOptions`, `ReadmeOptions`, `TsconfigOptions`, `TurboOptions`, `VscodeOptions`, `WorkspaceOptions`, and supporting types). Clears 36 `ae-missing-release-tag` diagnostics from the API Extractor pass without changing any runtime behavior.

## 0.1.3

### Dependencies

* | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | js-yaml                                                                                           | dependency | updated | ^4.1.1 | ^4.2.0 |    |
  | sort-package-json                                                                                 | dependency | updated | ^3.6.1 | ^4.0.0 |    |

## 0.1.2

### Build System

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`.

## 0.1.1

### Other

* [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments

## 0.1.0

### Features

* [`590e079`](https://github.com/savvy-web/systems/commit/590e0799efb47f5a70f091487f266042bbb7e5b9) Initial release of @savvy-web/templates — pure TypeScript library for Silk Suite project scaffolding. Includes 10 template functions for generating package.json, tsconfig, biome, turbo, pnpm workspace, gitignore, changeset config, VS Code settings, README, and full workspace compositions. All templates use Effect Schema validation with no runtime I/O.
