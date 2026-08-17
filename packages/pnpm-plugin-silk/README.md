# @savvy-web/pnpm-plugin-silk

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fpnpm-plugin-silk?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/pnpm-plugin-silk)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D11-orange)](https://pnpm.io/)

Centralized dependency-version management for the Silk ecosystem, delivered as a pnpm config dependency. Define dependency catalogs, security overrides and install-time policy once, then share them across every repository in the ecosystem.

## Install

Add as a config dependency using pnpm:

```bash
pnpm add --config @savvy-web/pnpm-plugin-silk
# writes the configDependencies entry shown below into pnpm-workspace.yaml
```

The entry carries the required integrity hash, which pnpm fills in along with the version:

```yaml
configDependencies:
  "@savvy-web/pnpm-plugin-silk": "npm:@savvy-web/pnpm-plugin-silk@<version>+sha512-..."
```

## Quick start

Reference Silk catalogs in your `package.json`:

```json
{
  "devDependencies": {
    "tsdown": "catalog:build",
    "typescript": "catalog:build",
    "vitest": "catalog:test"
  },
  "peerDependencies": {
    "typescript": "catalog:build:peers"
  }
}
```

A catalog supplies the current version for a direct dependency, and its `:peers` companion supplies the permissive range for the same package declared as a peer. Security overrides, build allowlists and hoist patterns merge automatically during `pnpm install`.

## Catalogs

Five catalogs ship with the plugin, each paired with a `:peers` variant that carries wider ranges for `peerDependencies`.

| Catalog | Peer catalog | Contents |
| ------- | ------------ | --------- |
| `build` | `build:peers` | `tsdown`, `rolldown`, `@rsbuild/core`, the `@tsdown/*` add-ons, TypeScript, `tsx`, React and the matching `@types/*` packages |
| `docs` | `docs:peers` | `@rspress/core` and its sitemap and mermaid plugins, VitePress, Vite, React and the matching `@types/*` packages |
| `lint` | `lint:peers` | Biome, `@changesets/cli`, commitlint, husky, `lint-staged`, `markdownlint-cli2` and Turborepo |
| `silk` | `silk:peers` | the shared repo toolchain that has no more specific home: TypeScript and the native-preview compiler, `tsx`, husky, `lint-staged`, `markdownlint-cli2`, React and the `@types/*` packages |
| `test` | `test:peers` | Vitest and its Istanbul and V8 coverage providers |

Effect is not one of them. `effect` and the whole `@effect/*` family come from [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect) as `catalog:effect` and `catalog:effect:peers`, so a repo that builds on Effect installs that config dependency alongside this one.

## Features

- **Purpose-scoped catalogs** — five catalog pairs keyed by what the dependency is for, rather than one flat list every consumer inherits whole
- **Security overrides** — centralized CVE fixes and compatibility pins via `overrides` that propagate to every consuming repository
- **Build allowlist** — an `allowBuilds` map controls which packages may run install scripts; consuming repos extend it per key
- **Security defaults** — `strictDepBuilds`, `blockExoticSubdeps` and `minimumReleaseAge` are enforced by default; weakening one triggers a warning
- **Workspace settings inheritance** — `publicHoistPattern` and `allowedDeprecatedVersions` merge into consuming workspaces
- **Peer dependency rules** — `peerDependencyRules.allowedVersions` suppresses common peer-dependency warnings
- **Non-destructive merging** — local definitions always win, with warnings when they diverge from the shared defaults

## License

[MIT](LICENSE)
