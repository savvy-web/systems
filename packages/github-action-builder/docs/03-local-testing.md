# Local testing

This guide explains how to test your GitHub Action locally using the `persistLocal` feature and [nektos/act](https://github.com/nektos/act).

## Why local testing?

GitHub's `node24` runtime will not run a repository's own compiled `pre.js` scripts when the action is referenced with `uses: ./`. The runner expects the action to live in a subdirectory under `.github/actions/`, not in the repository root. `persistLocal` works around this: after every build it copies your output to a local action directory where act can find it.

## What persistLocal does

After each successful build, the builder:

1. Copies `action.yml` to `.github/actions/local/`
2. Copies the entire `dist/` directory to `.github/actions/local/dist/`
3. Generates act template files if they do not already exist

The result is a complete action directory that act can reference directly.

```text
.github/actions/local/
├── action.yml       # Copied from project root
└── dist/
    ├── main.js      # Bundled entry points
    ├── pre.js
    ├── post.js
    └── package.json
```

## How files are synced

The builder compares file hashes before it writes anything:

* **Changed files** are copied to the destination
* **Unchanged files** are skipped — no write happens
* **Stale files** that exist in the destination but no longer exist in the source are removed

So the local action directory always matches your latest build, and a build that changed nothing copies nothing.

## Getting started with act

### Prerequisites

Install [nektos/act](https://github.com/nektos/act):

```bash
# macOS
brew install act

# Other platforms: see https://nektosact.com/installation/
```

### First run

Build your action and run it locally:

```bash
# Build (automatically persists to .github/actions/local/)
npm run build

# Run with act
act
```

On the first build with `actTemplate` enabled, the builder generates two
template files:

#### .actrc

```text
--container-architecture linux/amd64
-W .github/workflows/act-test.yml
```

This configures act to use the correct container architecture and points it
to the test workflow.

#### .github/workflows/act-test.yml

```yaml
name: Local Test
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: ./.github/actions/local
```

This workflow references your local action directory so act can execute it.

### Customizing the test workflow

The generated `act-test.yml` is a minimal starting point. Edit it to match your action's inputs and test scenarios:

```yaml
name: Local Test
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: ./.github/actions/local
        with:
          example-input: "test value"
```

The builder never overwrites a template file that already exists, so it leaves your edits alone.

## Configuration

Configure `persistLocal` in your `action.config.ts`:

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
  persistLocal: {
    enabled: true,
    path: ".github/actions/local",
    actTemplate: true,
  },
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Enable/disable local persistence |
| `path` | `string` | `".github/actions/local"` | Output directory relative to project root |
| `actTemplate` | `boolean` | `true` | Generate act boilerplate files if missing |

For full details on each option, see [Configuration](./02-configuration.md).

## CLI usage

### Skip persistence

Use `--no-persist` to skip the persist step for a single build:

```bash
github-action-builder build --no-persist
```

Use it while iterating on source code, when you want a quick build and do not need the local action directory refreshed.

### Typical development workflow

```bash
# Edit source code
vim src/main.ts

# Build and persist
npm run build

# Test locally with act
act

# Iterate...
```

## Programmatic API

When using the programmatic API, the build result includes a `persistLocal` field with details about the persist operation:

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

const action = GitHubAction.create();
const result = await action.build();

if (result.success && result.persistLocal) {
  console.log(`Output: ${result.persistLocal.outputPath}`);
  console.log(`Files copied: ${result.persistLocal.filesCopied}`);
  console.log(`Files skipped: ${result.persistLocal.filesSkipped}`);
  // Output: /path/to/project/.github/actions/local
  // Files copied: <count of new or changed files>
  // Files skipped: <count of unchanged files>
}
```

The `persistLocal` result contains:

| Field | Type | Description |
| --- | --- | --- |
| `success` | `boolean` | Whether the operation completed |
| `filesCopied` | `number` | Number of files copied (new or changed) |
| `filesSkipped` | `number` | Number of files skipped (unchanged) |
| `actTemplateGenerated` | `boolean` | Whether act template files were created |
| `outputPath` | `string` | Absolute path to the output directory |
| `error` | `string?` | Error message if the operation failed |

## Disabling persistLocal

To disable local persistence entirely, set `enabled` to `false` in your configuration:

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
  persistLocal: {
    enabled: false,
  },
});
```

When disabled, the builder skips the persist step completely and does not generate any template files.

## Git ignore

You may want to add the local action directory and act configuration to your `.gitignore`:

```text
# Local testing
.github/actions/local/
.actrc
```

Alternatively, commit the local action directory if you want CI to be able to reference it directly.

## Related documentation

* [Configuration](./02-configuration.md) - All configuration options
* [CLI reference](./04-cli-reference.md) - Command reference
* [Getting started](./01-getting-started.md) - Project setup
* [Troubleshooting](./06-troubleshooting.md) - Common issues
