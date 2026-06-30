# @savvy-web/pnpm-plugin-silk

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fpnpm-plugin-silk?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/pnpm-plugin-silk)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![TypeScript 6.0](https://img.shields.io/badge/TypeScript-6.0-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D11-orange)](https://pnpm.io/)

Centralized dependency-version management for the Silk ecosystem, delivered as a pnpm config dependency. Define dependency catalogs, security overrides and build settings once, then share them across every repository in the ecosystem.

## Features

- **Dual catalog strategy** — current versions for direct dependencies (`catalog:silk`) and permissive ranges for peer dependencies (`catalog:silkPeers`)
- **Security overrides** — centralized CVE fixes via `overrides` that propagate to every consuming repository
- **Build allowlist** — an `allowBuilds` map controls which packages may run install scripts; consuming repos extend it per key
- **Security defaults** — `strictDepBuilds`, `blockExoticSubdeps` and `minimumReleaseAge` are enforced by default; weakening one triggers a warning
- **Workspace settings inheritance** — `publicHoistPattern` and `allowedDeprecatedVersions` merge into consuming workspaces
- **Peer dependency rules** — `peerDependencyRules.allowedVersions` suppresses common peer-dependency warnings
- **Effect ecosystem coordination** — the full `@effect/*` package family and `effect` itself, pinned to mutually compatible versions
- **Non-destructive merging** — local definitions always win, with warnings when they diverge from the shared defaults

## Install

Add as a config dependency using pnpm:

```bash
pnpm add --config @savvy-web/pnpm-plugin-silk
```

This adds the package to your `pnpm-workspace.yaml` with the required integrity hash (pnpm fills in the version and hash automatically):

```yaml
configDependencies:
  "@savvy-web/pnpm-plugin-silk": "npm:@savvy-web/pnpm-plugin-silk@<version>+sha512-..."
```

## Quick start

Reference Silk catalogs in your `package.json`:

```json
{
  "devDependencies": {
    "typescript": "catalog:silk",
    "vitest": "catalog:silk"
  },
  "peerDependencies": {
    "typescript": "catalog:silkPeers"
  }
}
```

The `silk` catalog supplies current versions for direct dependencies and `silkPeers` supplies permissive ranges for peers. Security overrides, build allowlists and hoist patterns merge automatically during `pnpm install`.

## License

[MIT](LICENSE)
