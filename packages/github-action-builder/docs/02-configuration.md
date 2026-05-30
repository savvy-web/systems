# Configuration

Every configuration option for `@savvy-web/github-action-builder` and what it does.

## Configuration file

Create `action.config.ts` in your project root to customize the build. The file is optional — the builder runs with defaults when it is absent.

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  entries: { /* ... */ },
  build: { /* ... */ },
  validation: { /* ... */ },
});
```

The `GitHubAction.create()` helper gives you TypeScript autocomplete and checks the configuration at build time.

## Configuration sections

### entries

Configure entry point paths for your action.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `main` | `string` | `"src/main.ts"` | Main action entry point (required) |
| `pre` | `string` | `undefined` | Pre-action hook (runs before main) |
| `post` | `string` | `undefined` | Post-action hook (runs after main) |

#### Custom entry points

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  entries: {
    main: "src/action.ts",
    pre: "src/setup.ts",
    post: "src/cleanup.ts",
  },
});
```

#### Main only (default behavior)

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  entries: {
    main: "src/main.ts",
    // pre and post are auto-detected if files exist
  },
});
```

#### Auto-detection

If you do not specify `pre` or `post` in your config, the builder automatically detects these files:

* `src/pre.ts` - included if exists
* `src/post.ts` - included if exists

The `main` entry point (`src/main.ts` by default) is always required.

### build

Configure how your action is bundled.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `minify` | `boolean` | `true` | Minify output for smaller bundles |
| `target` | `string` | `"es2022"` | ECMAScript target version |
| `sourceMap` | `boolean` | `false` | Generate source maps |
| `externals` | `string[]` | `[]` | Packages to leave out of the bundle; must be available at runtime |
| `ignore` | `string[]` | `[]` | Packages to leave out of the bundle and replace with a stub that throws if loaded |
| `quiet` | `boolean` | `false` | Suppress build output |

#### Development build with source maps

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  build: {
    minify: false,
    sourceMap: true,
  },
});
```

#### Exclude packages from bundle (available at runtime)

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  build: {
    externals: ["@aws-sdk/client-s3"],
  },
});
```

#### Exclude packages from bundle (not available at runtime)

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  build: {
    ignore: ["cpu-features", "bufferutil"],
  },
});
```

#### Build options details

##### minify

When `true` (default), the bundled output is minified to reduce file size. Minification strips whitespace and shortens identifiers.

Disable for easier debugging:

```typescript
build: {
  minify: false,
}
```

##### target

The ECMAScript target for the output. Valid values:

* `"es2020"`
* `"es2021"`
* `"es2022"` (default)
* `"es2023"`
* `"es2024"`

The target affects which JavaScript features are used in the output. Since GitHub Actions runs Node.js 24, `es2022` or later is recommended.

##### sourceMap

When `true`, generates source map files alongside the bundled JavaScript. A source map maps the minified output back to your original TypeScript, so a stack trace points at the line you wrote.

Source maps are **disabled by default** because:

* They increase bundle size
* GitHub Actions errors show the bundled line numbers anyway
* Most users do not need them for production actions

Enable for debugging:

```typescript
build: {
  sourceMap: true,
}
```

##### externals

An array of package names to leave out of the bundle. These packages stay out of `dist/main.js` and must be available in the action's runtime environment — installed in the action's `node_modules`. Use it for packages that cannot be bundled, or that you install alongside the action.

```typescript
build: {
  externals: ["sharp", "@aws-sdk/client-s3"],
}
```

**Note:** Relying on runtime-installed packages is unusual for GitHub Actions. Most actions bundle everything. Reach for `externals` only when bundling will not work. For optional transitive dependencies that the action never loads, use [`ignore`](#ignore) instead.

##### ignore

An array of package names to leave out of the bundle and replace with a stub that throws a descriptive error if the module is ever loaded at runtime. Use this for optional transitive dependencies — native modules or optional peer dependencies that the action's code guards with a `try/catch` and never exercises on the GitHub Actions runner.

```typescript
build: {
  ignore: ["cpu-features", "bufferutil"],
}
```

The difference from `externals`:

| Option | Bundled? | Available at runtime? | What happens if loaded? |
| --- | --- | --- | --- |
| `externals` | No | Must be | Resolves normally |
| `ignore` | No | No | Throws a descriptive error |

If a module appears in both lists, `ignore` takes precedence — the stub is applied and the module is not externalized.

Matching is exact: `ignore: ["cpu-features"]` stubs `cpu-features` but not a subpath import such as `cpu-features/native`. If a dependency reaches an ignored module through a subpath, add that subpath specifier to the list as well.

##### quiet

When `true`, suppresses non-error build output. Handy in CI pipelines where you only want to see errors.

```typescript
build: {
  quiet: true,
}
```

### validation

Configure validation behavior.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `requireActionYml` | `boolean` | `true` | Require action.yml to exist |
| `maxBundleSize` | `string` | `undefined` | Maximum bundle size (e.g., "5mb") |
| `strict` | `boolean` | `undefined` | Treat warnings as errors |

#### Set bundle size limit

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  validation: {
    maxBundleSize: "10mb",
    strict: true,
  },
});
```

#### Skip action.yml validation

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  validation: {
    requireActionYml: false,
  },
});
```

#### Validation options details

##### requireActionYml

When `true` (default), the build fails if `action.yml` is missing or invalid.

Set to `false` if you are building a library or testing without an action.yml:

```typescript
validation: {
  requireActionYml: false,
}
```

##### maxBundleSize

Set a maximum bundle size. Validation fails if the bundle exceeds the limit, which keeps the action fast to download.

Supported units:

* `"500kb"` - kilobytes
* `"5mb"` - megabytes

```typescript
validation: {
  maxBundleSize: "5mb",
}
```

##### strict

Controls whether warnings are treated as errors.

* `undefined` (default): Auto-detects from environment
  * In CI (`CI=true`): warnings become errors
  * Locally: warnings are shown but build continues
* `true`: Always treat warnings as errors
* `false`: Never treat warnings as errors

```typescript
validation: {
  strict: true, // Always fail on warnings
}
```

### persistLocal

Configure automatic persistence of build output to a local action directory for testing with [nektos/act](https://github.com/nektos/act).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Enable/disable persisting build output locally |
| `path` | `string` | `".github/actions/local"` | Output directory relative to project root |
| `actTemplate` | `boolean` | `true` | Generate act boilerplate files if they don't exist |

#### Default behavior

With no configuration, `persistLocal` is enabled. After each build, the builder copies `action.yml` and `dist/` to `.github/actions/local/` and generates act template files (`.actrc` and `.github/workflows/act-test.yml`) if they do not already exist.

#### Custom output path

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
  persistLocal: {
    path: ".github/actions/my-action",
  },
});
```

#### Disable persist local

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
  persistLocal: {
    enabled: false,
  },
});
```

#### Persist local options details

##### enabled

When `true` (default), the builder copies `action.yml` and the `dist/` directory to the local action path after every successful build. Uses hash-based comparison to skip unchanged files and removes stale files from the destination.

Disable to skip local persistence entirely:

```typescript
persistLocal: {
  enabled: false,
}
```

You can also skip persistence for a single build using the `--no-persist` CLI flag without changing your configuration.

##### path

The output directory for the local action, relative to the project root. Defaults to `".github/actions/local"`.

The directory is created automatically if it does not exist.

```typescript
persistLocal: {
  path: ".github/actions/dev",
}
```

##### actTemplate

When `true` (default), the builder generates act boilerplate files when they do not already exist:

* `.actrc` - Default act options
* `.github/workflows/act-test.yml` - Minimal workflow for local testing

Existing files are never overwritten. Set to `false` if you manage these files yourself:

```typescript
persistLocal: {
  actTemplate: false,
}
```

For a detailed guide on local testing with act, see [Local testing](./03-local-testing.md).

## Full configuration example

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
  // Entry points
  entries: {
    main: "src/main.ts",
    pre: "src/pre.ts",
    post: "src/post.ts",
  },

  // Build options
  build: {
    minify: true,
    target: "es2022",
    sourceMap: false,
    externals: [],
    ignore: [],
    quiet: false,
  },

  // Validation
  validation: {
    requireActionYml: true,
    maxBundleSize: "10mb",
    strict: undefined, // Auto-detect from CI
  },

  // Persist local
  persistLocal: {
    enabled: true,
    path: ".github/actions/local",
    actTemplate: true,
  },
});
```

## Zero configuration

The builder works without any configuration file. These defaults are applied:

```typescript
{
  entries: {
    main: "src/main.ts",
    // pre/post auto-detected if files exist
  },
  build: {
    minify: true,
    target: "es2022",
    sourceMap: false,
    externals: [],
    ignore: [],
    quiet: false,
  },
  validation: {
    requireActionYml: true,
    strict: undefined, // CI-aware
  },
  persistLocal: {
    enabled: true,
    path: ".github/actions/local",
    actTemplate: true,
  },
}
```

## Config file location

The builder looks for configuration in this order:

1. Path specified with `--config` flag
2. `action.config.ts` in the current directory
3. `action.config.js` in the current directory
4. `action.config.mjs` in the current directory

TypeScript config files (`.ts`) are loaded with [jiti](https://github.com/unjs/jiti), so they work on CI runners that have no TypeScript loader registered.

## Shared TypeScript configuration

The package exports a base `tsconfig.json` for GitHub Action projects:

```json
{
  "extends": ["@savvy-web/github-action-builder/tsconfig/action.json"]
}
```

It sets the defaults Node.js 24 ESM actions need:

* `target`: ES2022
* `module`: ESNext with bundler resolution
* `strict`: enabled
* Includes patterns for `src/`, `lib/`, `__test__/`, `types/`, and root-level TypeScript files (covers `action.config.ts`)

Override any setting in your project's `tsconfig.json` as needed.

## Programmatic configuration

When using the programmatic API, pass configuration directly:

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

const action = GitHubAction.create({
  config: {
    build: {
      minify: false,
      sourceMap: true,
    },
  },
});

const result = await action.build();
```

Or reference a config file:

```typescript
const action = GitHubAction.create({
  config: "./custom.config.ts",
});
```

## Related documentation

* [CLI reference](./04-cli-reference.md) - Command-line options
* [Getting started](./01-getting-started.md) - Project setup
* [Troubleshooting](./06-troubleshooting.md) - Common issues
