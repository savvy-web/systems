# CLI reference

Complete reference for the `github-action-builder` command-line interface.

## Overview

```bash
github-action-builder <command> [options]
```

Available commands:

| Command | Description |
| --- | --- |
| `build` | Bundle entry points into production-ready JavaScript |
| `validate` | Check configuration and action.yml without building |
| `init` | Create a new GitHub Action project |

## github-action-builder build

Bundle all entry points into the `dist/` directory.

**Usage:**

```bash
github-action-builder build [options]
```

**Options:**

| Option | Alias | Description | Default |
| --- | --- | --- | --- |
| `--config <path>` | `-c` | Path to configuration file | `action.config.ts` |
| `--quiet` | `-q` | Suppress non-error output | `false` |
| `--no-validate` | | Skip validation step | `false` |
| `--no-persist` | | Skip persisting build output to local action directory | `false` |

**Examples:**

Basic build:

```bash
github-action-builder build
```

Build with custom config:

```bash
github-action-builder build --config ./configs/action.config.ts
```

Quiet build for CI:

```bash
github-action-builder build --quiet
```

Build without validation:

```bash
github-action-builder build --no-validate
```

Build without persisting locally:

```bash
github-action-builder build --no-persist
```

**Build process:**

`build` runs four steps in order:

1. Loads configuration from `action.config.ts` (or defaults)
2. Validates the project (unless `--no-validate`)
3. Bundles each entry point with rsbuild (rspack)
4. Writes output to `dist/`

Example output:

```text
Loading configuration...
  Found action.config.ts

Validating...
  All checks passed

Building...

Build Summary:
  main: <size> (<time>) -> dist/main.js
  post: <size> (<time>) -> dist/post.js

Total time: <total>

Build completed successfully!
```

**Exit codes:**

| Code | Meaning |
| --- | --- |
| `0` | Build succeeded |
| `1` | Build failed (validation error, bundle error, etc.) |

## github-action-builder validate

Check configuration and action.yml without building.

**Usage:**

```bash
github-action-builder validate [options]
```

**Options:**

| Option | Alias | Description | Default |
| --- | --- | --- | --- |
| `--config <path>` | `-c` | Path to configuration file | `action.config.ts` |
| `--quiet` | `-q` | Suppress non-error output | `false` |

**Examples:**

Basic validation:

```bash
github-action-builder validate
```

Validate with custom config:

```bash
github-action-builder validate --config ./my-config.ts
```

**What gets validated:**

`validate` checks three things:

1. **Configuration**
   * Config file syntax (if provided)
   * Schema validation for all options

2. **Entry points**
   * `src/main.ts` exists (required)
   * `src/pre.ts` exists (if configured)
   * `src/post.ts` exists (if configured)

3. **action.yml**
   * File exists (if `requireActionYml: true`)
   * Valid YAML syntax
   * Matches GitHub's action metadata schema
   * `runs.using` is set to `node24`

**Validation output:**

Example validation output:

```text
Loading configuration...
  Using default configuration

Validating...

Validation Results:
  Entry points: 2 found (main, post)
  action.yml: Valid

Validation completed successfully!
```

Example with errors:

```text
Loading configuration...
  Using default configuration

Validating...

Validation Results:
  ERRORS:
  - action.yml: runs.using must be "node24", found "node20"
  - Entry point not found: src/main.ts

Validation failed with 2 errors
```

**Exit codes:**

| Code | Meaning |
| --- | --- |
| `0` | Validation passed |
| `1` | Validation failed |

## github-action-builder init

Create a new GitHub Action project, including every file the action needs to build.

**Usage:**

```bash
github-action-builder init <action-name> [options]
```

**Arguments:**

| Argument | Description |
| --- | --- |
| `<action-name>` | Name of the action (also the output directory) |

**Options:**

| Option | Alias | Description | Default |
| --- | --- | --- | --- |
| `--force` | `-f` | Overwrite existing files | `false` |

**Examples:**

Create a new action project:

```bash
npx @savvy-web/github-action-builder init my-action
cd my-action
npm install
npm run build
```

Overwrite existing files:

```bash
github-action-builder init my-action --force
```

**Generated files:**

`init` writes this project structure:

```text
my-action/
├── package.json       # Project dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── action.yml         # GitHub Action metadata
├── action.config.ts   # Build configuration
└── src/
    ├── main.ts        # Main action entry point
    ├── pre.ts         # Pre-action hook
    └── post.ts        # Post-action cleanup
```

**package.json:**

```json
{
  "name": "my-action",
  "type": "module",
  "scripts": {
    "build": "github-action-builder build",
    "validate": "github-action-builder validate",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@savvy-web/github-action-builder": "^x.x.x",
    "typescript": "^5.9.3"
  },
  "dependencies": {
    "@actions/core": "^1.11.1",
    "@actions/github": "^6.0.0"
  }
}
```

**action.config.ts:**

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  // Entry points are auto-detected from src/main.ts, src/pre.ts, src/post.ts
  // Uncomment to customize:
  // entries: {
  //   main: "src/main.ts",
  //   pre: "src/pre.ts",
  //   post: "src/post.ts",
  // },

  // Build options
  // build: {
  //   minify: true,
  //   sourceMap: false,
  //   externals: [],
  // },
});
```

**Init output:**

```text
Created my-action/
  package.json
  tsconfig.json
  action.yml
  action.config.ts
  src/main.ts
  src/pre.ts
  src/post.ts

Next steps:
  cd my-action
  npm install
  npm run build
```

**Exit codes:**

| Code | Meaning |
| --- | --- |
| `0` | Project created successfully |
| `1` | Directory exists (use `--force`) |

## Global options

These options work with all commands:

| Option | Description |
| --- | --- |
| `--help` | Show help for a command |
| `--version` | Show version number |

**Examples:**

```bash
# Show global help
github-action-builder --help

# Show help for build command
github-action-builder build --help

# Show version
github-action-builder --version
```

## Environment variables

Two environment variables change CLI behavior:

| Variable | Effect |
| --- | --- |
| `CI=true` | Enables strict mode (warnings become errors) |
| `GITHUB_ACTIONS=true` | Enables strict mode |

### CI detection

When `CI` or `GITHUB_ACTIONS` is set, the builder switches on strict mode: validation warnings are treated as errors and the build fails on any issue. This stops a marginal action.yml from shipping just because no human watched the log.

To opt out, set the `strict` configuration option:

```typescript
// action.config.ts
export default defineConfig({
  validation: {
    strict: false, // Never treat warnings as errors
  },
});
```

## Using with npm scripts

Wire the commands into `package.json`:

```json
{
  "scripts": {
    "build": "github-action-builder build",
    "validate": "github-action-builder validate",
    "build:debug": "github-action-builder build --no-validate"
  }
}
```

Then run:

```bash
npm run build
npm run validate
```

## Using with npx

Run without installing:

```bash
npx @savvy-web/github-action-builder build
npx @savvy-web/github-action-builder validate
npx @savvy-web/github-action-builder init
```

## Related documentation

* [Configuration](./02-configuration.md) - All configuration options
* [Getting started](./01-getting-started.md) - Project setup
* [Troubleshooting](./06-troubleshooting.md) - Common issues
