# @savvy-web/pnpm-plugin-silk

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fpnpm-plugin-silk?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/pnpm-plugin-silk)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![TypeScript 6.0](https://img.shields.io/badge/TypeScript-6.0-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D11-orange)](https://pnpm.io/)

Centralized dependency version management for the Silk ecosystem via pnpm config dependencies. Share curated dependency catalogs, security overrides and build configurations across multiple repositories from a single source of truth.

## Features

- **Dual catalog strategy** — Current versions for direct dependencies (`catalog:silk`), permissive ranges for peer dependencies (`catalog:silkPeers`)
- **Security overrides** — Centralized CVE fixes via `overrides` that propagate to all consuming repositories
- **Build allowlist** — `allowBuilds` map (pnpm 11) controls which packages may run install scripts; local repos can extend it per-key
- **Security defaults** — `strictDepBuilds`, `blockExoticSubdeps` and `minimumReleaseAge` are enforced by default; weakening them triggers a prominent warning
- **Workspace settings inheritance** — `publicHoistPattern`, `packageExtensions`, `allowedDeprecatedVersions`, `supportedArchitectures` and `auditConfig` all merge into child workspaces
- **Peer dependency rules** — Syncs `peerDependencyRules` (allowedVersions, ignoreMissing, allowAny) to suppress common peer warnings
- **Effect ecosystem management** — 26 coordinated `@effect/*` packages across eight functional groups with compatible version resolution
- **Non-destructive merging** — Local definitions always take precedence, with clear warnings for divergences

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

The `silk` catalog provides current/latest versions for direct dependencies, while `silkPeers` provides permissive ranges for peer dependencies. Security overrides, build script allowlists and hoist patterns are automatically merged during `pnpm install`.


## License

[MIT](LICENSE)
