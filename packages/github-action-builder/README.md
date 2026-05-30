# @savvy-web/github-action-builder

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fgithub-action-builder?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/github-action-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-5fa04e.svg)](https://nodejs.org/)

Build a GitHub Action from TypeScript source without writing build config. The builder bundles your code with [@rsbuild/core](https://github.com/web-infra-dev/rsbuild) (rspack under the hood) and checks `action.yml` against GitHub's published metadata schema. The output is a single Node.js 24 file you commit to your repo.

## Features

- **No build config required** - Picks up entry points from `src/main.ts`, `src/pre.ts`, `src/post.ts` on its own
- **Node.js 24** - Emits ESM actions that run on the `node24` GitHub Actions runtime
- **Schema validation** - Validates `action.yml` against GitHub's official metadata specification
- **Single-file bundles** - All npm dependencies inlined via rsbuild; `node:` builtins externalized; user-configured `externals` and `ignore` options for optional or native modules
- **Local testing** - Auto-persists build output for testing with [nektos/act](https://github.com/nektos/act)
- **CI-aware** - Strict validation in CI, warnings-only locally

## Quick start

Scaffold a new GitHub Action project, then build it:

```bash
npx @savvy-web/github-action-builder init my-action
cd my-action
npm install
npm run build
```

The `init` command lays down the project:

```text
my-action/
├── src/
│   ├── main.ts      # Main action entry point
│   ├── pre.ts       # Pre-action hook
│   └── post.ts      # Post-action cleanup
├── action.yml       # GitHub Action metadata
├── action.config.ts # Build configuration
├── package.json     # Dependencies and scripts
└── tsconfig.json    # TypeScript configuration
```

Put your action logic in `src/main.ts` and run `npm run build` again. The bundled action lands at `dist/main.js` — commit that file to your repo.

## Basic usage

### Initialize

Create a new GitHub Action project:

```bash
npx @savvy-web/github-action-builder init my-action
```

### Build

Bundle all entry points into `dist/`:

```bash
npm run build
# or directly:
npx @savvy-web/github-action-builder build
```

### Validate

Check your `action.yml` and configuration without building:

```bash
npm run validate
# or directly:
npx @savvy-web/github-action-builder validate
```

## Project structure

The builder expects this structure:

```text
my-action/
├── src/
│   ├── main.ts     # Required - main action entry point
│   ├── pre.ts      # Optional - runs before main
│   └── post.ts     # Optional - runs after main (cleanup)
├── action.yml      # GitHub Action metadata (runs.using: "node24")
├── action.config.ts # Optional configuration
└── package.json
```

## Configuration

Customize `action.config.ts` for your project:

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  entries: {
    main: "src/main.ts",
    post: "src/cleanup.ts",
  },
  build: {
    minify: true,
    sourceMap: false,
  },
});
```

## action.yml requirements

Your `action.yml` must use Node.js 24:

```yaml
name: "My Action"
description: "Does something useful"
runs:
  using: "node24"
  main: "dist/main.js"
  post: "dist/post.js" # Optional
```

## Documentation

- [Getting started](./docs/01-getting-started.md) - Installation and first build
- [Configuration](./docs/02-configuration.md) - All configuration options
- [Local testing](./docs/03-local-testing.md) - Testing with nektos/act
- [CLI reference](./docs/04-cli-reference.md) - Complete command reference
- [Architecture](./docs/05-architecture.md) - How it works internally
- [Troubleshooting](./docs/06-troubleshooting.md) - Common issues and solutions

## Programmatic API

Use the builder programmatically in your scripts:

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

const action = GitHubAction.create();
const result = await action.build();

if (result.success) {
  console.log(`Built ${result.build?.entries.length} entry points`);
  // e.g. "Built 3 entry points"
}
```

## Shared TypeScript configuration

The package exports a base `tsconfig.json` for GitHub Action projects:

```json
{
  "extends": ["@savvy-web/github-action-builder/tsconfig/action.json"]
}
```

It sets up Node.js 24 ESM actions with strict mode, an ES2022 target and bundler module resolution. Override any of it in your own `tsconfig.json`.

## Requirements

- Node.js 24+
- TypeScript source files
- `action.yml` with `runs.using: "node24"`

## License

MIT
