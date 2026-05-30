# Getting started

Set up your first GitHub Action with `@savvy-web/github-action-builder`.

## Prerequisites

- **Node.js 24** or later
- **npm**, **pnpm**, or **yarn**
- A GitHub repository for your action

## Quick start

Scaffold a new GitHub Action project, then build it:

```bash
npx @savvy-web/github-action-builder init my-action
cd my-action
npm install
npm run build
```

The `init` command generates a project that builds without further setup. Put your action logic in `src/main.ts` and run `npm run build` again.

## Generated project structure

The `init` command creates this structure:

```text
my-action/
├── src/
│   ├── main.ts      # Main action entry point
│   ├── pre.ts       # Pre-action hook (runs before main)
│   └── post.ts      # Post-action cleanup (runs after main)
├── action.yml       # GitHub Action metadata
├── action.config.ts # Build configuration
├── package.json     # Dependencies and scripts
└── tsconfig.json    # TypeScript configuration
```

## Understanding the generated files

### action.config.ts

The build configuration file:

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
  //   target: "es2022",
  // },
});
```

### action.yml

The GitHub Action metadata. The `runs.using` field **must** be `node24`:

```yaml
name: "my-action"
description: "A GitHub Action built with @savvy-web/github-action-builder"

inputs:
  example-input:
    description: "An example input"
    required: false
    default: "hello"

outputs:
  example-output:
    description: "An example output"

runs:
  using: "node24"
  main: "dist/main.js"
  pre: "dist/pre.js"
  post: "dist/post.js"

branding:
  icon: "zap"
  color: "blue"
```

### tsconfig.json

The generated `tsconfig.json` extends the shared base configuration:

```json
{
  "extends": ["@savvy-web/github-action-builder/tsconfig/action.json"]
}
```

This provides ES2022 target, strict mode, bundler module resolution, and includes patterns for `src/`, `lib/`, `__test__/`, and root-level TypeScript files like `action.config.ts`. You can override any setting in your project's `tsconfig.json`.

### src/main.ts

The main action entry point:

```typescript
import * as core from "@actions/core";

async function run(): Promise<void> {
  try {
    const input = core.getInput("example-input");
    core.info(`Running main action with input: ${input}`);

    // Your main action logic goes here

    core.setOutput("example-output", "success");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
```

## Alternative installation methods

### Global installation

Install globally to use the `github-action-builder` command anywhere:

```bash
npm install -g @savvy-web/github-action-builder
```

### Project installation

Install as a dev dependency (already included in generated projects):

```bash
npm install --save-dev @savvy-web/github-action-builder
```

### Using npx

Run any command without installing:

```bash
npx @savvy-web/github-action-builder build
npx @savvy-web/github-action-builder validate
```

## Building your action

### First build

Run the build command:

```bash
npm run build
```

You will see output like:

```text
Loading configuration...
  Found action.config.ts

Validating...
  All checks passed

Building...

Build Summary:
  ✓ main: <size> (<time>) → dist/main.js
  ✓ pre:  <size> (<time>) → dist/pre.js
  ✓ post: <size> (<time>) → dist/post.js

Total time: <total>

Build completed successfully!
```

### Understanding the output

After building, your `dist/` directory contains:

```text
dist/
├── main.js       # Bundled main action
├── pre.js        # Bundled pre-action hook
├── post.js       # Bundled post-action cleanup
└── package.json  # ESM module marker { "type": "module" }
```

Each bundled file holds your code and its dependencies in one file, minified by default, ready to run on Node.js 24 in GitHub Actions.

## Validation and type checking

### Validate configuration

Check your `action.yml` and configuration without building:

```bash
npm run validate
```

This verifies:

- `action.yml` exists and is valid YAML
- `action.yml` schema matches GitHub's specification
- `runs.using` is set to `node24`
- Required entry points exist

### Type check

Run TypeScript type checking:

```bash
npm run typecheck
```

### CI vs local behavior

The builder treats validation issues differently depending on where it runs.

**Local development:** validation issues show as warnings and the build continues, so you keep working while you fix them.

**CI environment (GitHub Actions):** validation issues become errors and the build fails, so a broken action never gets past the pipeline.

The builder treats itself as running in CI when `CI=true` or `GITHUB_ACTIONS=true` is set.

## Using your action

### Commit the dist directory

GitHub Actions runs the bundled code directly, so commit your `dist/` folder:

```bash
git add dist/
git commit -m "Build action"
git push
```

### Reference in workflows

Use your action in a workflow:

```yaml
# .github/workflows/test.yml
name: Test Action

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Run my action
        uses: ./
        with:
          name: "GitHub Actions"
```

### Publish to Marketplace

To publish on the GitHub Marketplace:

1. Create a release tag (e.g., `v1.0.0`)
2. Ensure `action.yml` has `branding` configured
3. Follow GitHub's
   [publishing guide](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)

## Next steps

- [Configuration](./02-configuration.md) - Customize build options
- [CLI reference](./04-cli-reference.md) - All available commands
- [Troubleshooting](./06-troubleshooting.md) - Common issues and solutions
