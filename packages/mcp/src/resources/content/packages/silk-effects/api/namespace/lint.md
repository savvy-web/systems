---
id: packages/silk-effects/api/namespace/lint
title: "Lint — silk-effects namespace"
summary: "namespace Lint from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# Lint

## Members

### BaseHandlerOptions

```ts
interface BaseHandlerOptions
```

Base options shared by all handlers.

### Biome

```ts
class Biome
```

Handler for JavaScript, TypeScript, and JSON files. Formats and lints with Biome. Biome discovery order: 1. Global `biome` command (preferred) 2. Local installation via `pnpm exec biome` 3. Local installation via `npx biome` Config file discovery: - Searches the workspace root for `biome.jsonc` or `biome.json`. - Falls back to CWD when not in a workspace. - No `lib/configs/` convention — biome configs live at workspace roots only.

### BiomeOptions

```ts
interface BiomeOptions extends BaseHandlerOptions
```

Options for the Biome handler.

### Command

```ts
class Command
```

Static utility class for shell command operations.

### createConfig

```ts
function createConfig(options?: CreateConfigOptions): LintStagedConfig;
```

Create a complete lint-staged configuration with all handlers.

### CreateConfigOptions

```ts
interface CreateConfigOptions
```

Options for createConfig() helper.

### DEFAULT_CONFIG_PATH

```ts
DEFAULT_CONFIG_PATH = "lib/configs/lint-staged.config.ts"
```

Default path for the lint-staged config file.

### Filter

```ts
class Filter
```

Static utility class for filtering file lists.

### generateManagedContent

```ts
function generateManagedContent(configPath: string): string;
```

Rendered content of the savvy-lint tool section.

### getWorkspacePackagePaths

```ts
function getWorkspacePackagePaths(): string[];
```

Get absolute paths of all leaf workspace package directories.

### getWorkspacePackages

```ts
function getWorkspacePackages(): WorkspacePackageInfo[] | null;
```

Get all leaf workspace packages (excludes root).

### getWorkspaceRoot

```ts
function getWorkspaceRoot(): string | null;
```

Get the workspace root directory.

### Handler

```ts
abstract class Handler
```

Abstract base class for lint-staged handlers. All handler classes follow this pattern and implement: - `glob` - The recommended glob pattern for matching files - `defaultExcludes` - Default patterns to exclude - `handler` - Pre-configured handler with defaults - `create()` - Factory method for custom configuration

### HUSKY_HOOK_PATH

```ts
HUSKY_HOOK_PATH = ".husky/pre-commit"
```

Path for the husky pre-commit hook.

### isWorkspacePackagePath

```ts
function isWorkspacePackagePath(filePath: string): boolean;
```

Check if a file path is at a workspace root or leaf workspace root.

### LegacySavvyLintHygieneDef

```ts
LegacySavvyLintHygieneDef: SectionDefinition
```

Identity definition for the legacy `SAVVY-LINT` hygiene section that previously lived in `.husky/post-checkout` and `.husky/post-merge`.

### LintStagedConfig

```ts
type LintStagedConfig = Record<string, LintStagedEntry | LintStagedEntry[]>;
```

A lint-staged configuration object. Maps glob patterns to handlers, commands, or arrays of sequential steps.

### LintStagedEntry

```ts
type LintStagedEntry = LintStagedHandler | string | string[];
```

A single lint-staged command entry: a handler function, a string command, or an array of strings.

### LintStagedHandler

```ts
type LintStagedHandler = (filenames: readonly string[]) => string | string[] | Promise<string | string[]>;
```

A lint-staged handler function. Receives an array of staged filenames and returns command(s) to execute. Uses `readonly string[]` to match lint-staged's type signature.

### Markdown

```ts
class Markdown
```

Handler for Markdown files. Lints and auto-fixes with markdownlint-cli2. Tool discovery order: 1. Global `markdownlint-cli2` command (preferred) 2. Local installation via `pnpm exec markdownlint-cli2` 3. Local installation via `npx markdownlint-cli2` Config file discovery order: 1. Explicit `config` option if provided 2. `lib/configs/.markdownlint-cli2.jsonc` (and variants) 3. Standard locations (`.markdownlint-cli2.jsonc` at repo root, etc.)

### MARKDOWNLINT_CONFIG_PATH

```ts
MARKDOWNLINT_CONFIG_PATH = "lib/configs/.markdownlint-cli2.jsonc"
```

Path for the markdownlint-cli2 config file.

### MARKDOWNLINT_CONFIG

```ts
MARKDOWNLINT_CONFIG: {
    readonly default: true;
    readonly MD001: true;
    readonly MD002: true;
    readonly MD003: true;
    readonly MD004: true;
    readonly MD005: true;
    readonly MD006: true;
    readonly MD007: true;
    readonly MD008: true;
    readonly MD009: true;
    readonly MD010: true;
    readonly MD011: true;
    readonly MD012: true;
    readonly MD013: false;
    readonly MD014: true;
    readonly MD015: true;
    readonly MD016: true;
    readonly MD017: true;
    readonly MD018: true;
    readonly MD019: true;
    readonly MD020: true;
    readonly MD021: true;
    readonly MD022: true;
    readonly MD023: true;
    readonly MD024: {
        readonly siblings_only: true;
    };
    readonly MD025: true;
    readonly MD026: true;
    readonly MD027: true;
    readonly MD028: true;
    readonly MD029: true;
    readonly MD030: true;
    readonly MD031: true;
    readonly MD032: true;
    readonly MD033: {
        readonly allowed_elements: readonly ["br", "details", "summary", "img", "sup", "sub"];
    };
    readonly MD034: true;
    readonly MD035: true;
    readonly MD036: true;
    readonly MD037: true;
    readonly MD038: true;
    readonly MD039: true;
    readonly MD040: true;
    readonly MD041: true;
    readonly MD042: true;
    readonly MD043: false;
    readonly MD044: false;
    readonly MD045: true;
    readonly MD046: true;
    readonly MD047: true;
    readonly MD048: true;
    readonly MD049: true;
    readonly MD050: true;
    readonly MD051: true;
    readonly MD052: true;
    readonly MD053: true;
    readonly MD054: true;
    readonly MD055: true;
    readonly MD056: true;
    readonly MD057: true;
    readonly MD058: true;
    readonly MD059: true;
    readonly MD060: {
        readonly style: "compact";
    };
    readonly "changeset-heading-hierarchy": false;
    readonly "changeset-required-sections": false;
    readonly "changeset-content-structure": false;
    readonly "changeset-uncategorized-content": false;
    readonly "changeset-dependency-table-format": false;
}
```

The `config` rules object from the template.

### MARKDOWNLINT_SCHEMA

```ts
MARKDOWNLINT_SCHEMA: "https://raw.githubusercontent.com/DavidAnson/markdownlint-cli2/v0.22.0/schema/markdownlint-cli2-config-schema.json"
```

The `$schema` URL from the template.

### MARKDOWNLINT_TEMPLATE

```ts
MARKDOWNLINT_TEMPLATE: {
    readonly $schema: "https://raw.githubusercontent.com/DavidAnson/markdownlint-cli2/v0.22.0/schema/markdownlint-cli2-config-schema.json";
    readonly globs: readonly ["**/*.{md,mdx}"];
    readonly fix: true;
    readonly gitignore: true;
    readonly noBanner: true;
    readonly ignores: readonly ["**/node_modules", "**/.cache", "**/coverage", "**/.coverage", "**/dist", "**/CHANGELOG.md", "**/.claude/plans", "**/docs/superpowers"];
    readonly customRules: readonly ["@savvy-web/silk/changesets/markdownlint"];
    readonly config: {
        readonly default: true;
        readonly MD001: true;
        readonly MD002: true;
        readonly MD003: true;
        readonly MD004: true;
        readonly MD005: true;
        readonly MD006: true;
        readonly MD007: true;
        readonly MD008: true;
        readonly MD009: true;
        readonly MD010: true;
        readonly MD011: true;
        readonly MD012: true;
        readonly MD013: false;
        readonly MD014: true;
        readonly MD015: true;
        readonly MD016: true;
        readonly MD017: true;
        readonly MD018: true;
        readonly MD019: true;
        readonly MD020: true;
        readonly MD021: true;
        readonly MD022: true;
        readonly MD023: true;
        readonly MD024: {
            readonly siblings_only: true;
        };
        readonly MD025: true;
        readonly MD026: true;
        readonly MD027: true;
        readonly MD028: true;
        readonly MD029: true;
        readonly MD030: true;
        readonly MD031: true;
        readonly MD032: true;
        readonly MD033: {
            readonly allowed_elements: readonly ["br", "details", "summary", "img", "sup", "sub"];
        };
        readonly MD034: true;
        readonly MD035: true;
        readonly MD036: true;
        readonly MD037: true;
        readonly MD038: true;
        readonly MD039: true;
        readonly MD040: true;
        readonly MD041: true;
        readonly MD042: true;
        readonly MD043: false;
        readonly MD044: false;
        readonly MD045: true;
        readonly MD046: true;
        readonly MD047: true;
        readonly MD048: true;
        readonly MD049: true;
        readonly MD050: true;
        readonly MD051: true;
        readonly MD052: true;
        readonly MD053: true;
        readonly MD054: true;
        readonly MD055: true;
        readonly MD056: true;
        readonly MD057: true;
        readonly MD058: true;
        readonly MD059: true;
        readonly MD060: {
            readonly style: "compact";
        };
        readonly "changeset-heading-hierarchy": false;
        readonly "changeset-required-sections": false;
        readonly "changeset-content-structure": false;
        readonly "changeset-uncategorized-content": false;
        readonly "changeset-dependency-table-format": false;
    };
}
```

Full markdownlint-cli2 config template.

### MarkdownOptions

```ts
interface MarkdownOptions extends BaseHandlerOptions
```

Options for the Markdown handler.

### PackageJson

```ts
class PackageJson
```

Handler for package.json files. Sorts fields with sort-package-json and formats with Biome.

### PackageJsonOptions

```ts
interface PackageJsonOptions extends BaseHandlerOptions
```

Options for the PackageJson handler.

### PackageManager

```ts
type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
```

Supported package managers.

### PnpmWorkspace

```ts
class PnpmWorkspace
```

Handler for pnpm-workspace.yaml. Sorts, formats, and validates pnpm-workspace.yaml using bundled libraries.

### PnpmWorkspaceContent

```ts
interface PnpmWorkspaceContent
```

Shape of pnpm-workspace.yaml content.

### PnpmWorkspaceOptions

```ts
interface PnpmWorkspaceOptions
```

Options for the PnpmWorkspace handler.

### POST_CHECKOUT_HOOK_PATH

```ts
POST_CHECKOUT_HOOK_PATH = ".husky/post-checkout"
```

Path for the husky post-checkout hook.

### POST_MERGE_HOOK_PATH

```ts
POST_MERGE_HOOK_PATH = ".husky/post-merge"
```

Path for the husky post-merge hook.

### Preset

```ts
class Preset
```

Preset configurations for common lint-staged setups.

### PresetExtendOptions

```ts
type PresetExtendOptions = CreateConfigOptions;
```

Options for extending a preset. Alias for CreateConfigOptions.

### PresetType

```ts
type PresetType = "minimal" | "standard" | "silk";
```

Preset type for standard configurations.

### resetWorkspaceCache

```ts
function resetWorkspaceCache(): void;
```

Clear all cached workspace data.

### savvyLintBlock

```ts
function savvyLintBlock(configPath: string): SectionBlock;
```

Build the savvy-lint tool section block for the given config path.

### SavvyLintSectionDef

```ts
SavvyLintSectionDef: SectionDefinition
```

Identity definition for the savvy-lint tool section (read / check / remove).

### ShellScripts

```ts
class ShellScripts
```

Handler for shell script files. Removes executable bit by default (security best practice).

### ShellScriptsOptions

```ts
interface ShellScriptsOptions extends BaseHandlerOptions
```

Options for the ShellScripts handler.

### ToolSearchResult

```ts
interface ToolSearchResult
```

Result of a tool search.

### TypeScript

```ts
class TypeScript
```

Handler for TypeScript files. Runs type checking with tsgo or tsc.

### TypeScriptCompiler

```ts
type TypeScriptCompiler = "tsgo" | "tsc";
```

TypeScript compiler to use.

### TypeScriptOptions

```ts
interface TypeScriptOptions extends BaseHandlerOptions
```

Options for the TypeScript handler.

### WorkspacePackageInfo

```ts
interface WorkspacePackageInfo
```

Minimal shape of a workspace package needed by this module.

### Yaml

```ts
class Yaml
```

Handler for YAML files. Formats with Prettier and validates with yaml-lint, both as bundled dependencies.

### YamlOptions

```ts
interface YamlOptions extends BaseHandlerOptions
```

Options for the Yaml handler.
