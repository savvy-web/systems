# @savvy-web/templates

[![npm version](https://img.shields.io/npm/v/@savvy-web/templates)](https://www.npmjs.com/package/@savvy-web/templates)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Pure TypeScript templates for Silk Suite project scaffolding. Each template takes typed options (validated with [Effect](https://effect.website/) Schema) and returns `TemplateEntry[]` -- a list of `{ name, filename, content }` records. No filesystem calls; you decide where and how to write the output.

## Features

- Generate config files for package.json, tsconfig, Biome, Turborepo, pnpm, changesets, VS Code, gitignore, and README
- Validate all inputs at runtime with Effect Schema
- Compose an entire workspace scaffold from a single `createWorkspace` call
- Zero side effects -- templates return plain strings, never touch disk

## Installation

```bash
pnpm add @savvy-web/templates effect
```

`effect` is a peer dependency.

## Quick Start

```typescript
import { createPackageJson } from "@savvy-web/templates";

const entries = createPackageJson({
  name: "@my-org/my-lib",
  description: "A useful library",
  type: "module",
  license: "MIT",
  exports: { ".": "./src/index.ts" },
});

for (const entry of entries) {
  console.log(entry.filename); // "package.json"
  console.log(entry.content);  // sorted, formatted JSON
}
```

## API

Every `create*` function accepts an options object (or `unknown` -- Schema validates at runtime) and returns `TemplateEntry[]`.

### TemplateEntry

```typescript
interface TemplateEntry {
  readonly name: string;     // logical name, e.g. "tsconfig"
  readonly filename: string; // suggested path, e.g. "tsconfig.json"
  readonly content: string;  // generated file content
}
```

### Templates

| Function | Output file | Key options |
| --- | --- | --- |
| `createPackageJson` | `package.json` | `name`, `version`, `type`, `exports`, `scripts`, `dependencies`, `engines`, `publishConfig` |
| `createTsConfig` | `tsconfig.json` | `extends`, `composite`, `include`, `exclude`, `references` |
| `createBiome` | `biome.jsonc` | `version`, `extends`, `root` |
| `createTurboRoot` | `turbo.json` | `tasks`, `globalDependencies`, `globalEnv`, `ui`, `concurrency` |
| `createTurboWorkspace` | `turbo.json` | `tasks` (extends root with `["//"]`) |
| `createPnpmWorkspace` | `pnpm-workspace.yaml` | `packages`, `autoInstallPeers`, `catalogMode`, `catalog` |
| `createChangeset` | `.changeset/config.json` | `access`, `baseBranch`, `changelog`, `repo` |
| `createVsCode` | `.vscode/settings.json`, `.vscode/extensions.json` | `settings` (`biome`, `turbo`, `vitest`), `extensions` |
| `createGitignore` | `.gitignore` | `sections` (`node`, `build`, `env`, `os`, `silk`), `additional` |
| `createReadme` | `README.md` | `name`, `description` |

### Workspace Compositor

`createWorkspace` composes multiple templates into a full monorepo scaffold:

```typescript
import { createWorkspace } from "@savvy-web/templates";

const entries = createWorkspace({
  name: "my-monorepo",
  packageManager: "pnpm",
  packageManagerVersion: "10.33.0",
  nodeVersion: "24.11.0",
  features: {
    biome: true,
    turbo: true,
    changesets: true,
    vscode: true,
    vitest: true,
  },
});

// entries contains: package.json, tsconfig.json, .gitignore, README.md,
// pnpm-workspace.yaml, biome.jsonc, turbo.json, .changeset/config.json,
// .vscode/settings.json, .vscode/extensions.json
```

Each feature flag is optional and defaults to `false`. The compositor always generates package.json, tsconfig.json, .gitignore, and README.md. pnpm-workspace.yaml is added automatically when `packageManager` is `"pnpm"`.

## License

[MIT](./LICENSE)
