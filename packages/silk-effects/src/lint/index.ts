/**
 * Lint namespace — lint-staged business logic extracted from \@savvy-web/lint-staged.
 *
 * @remarks
 * This barrel re-exports the complete lint-staged public surface (minus CLI/bin) from
 * the silk-effects package. Downstream consumers import via the Lint namespace:
 *
 * ```typescript
 * import { Lint } from "@savvy-web/silk-effects";
 * const config = Lint.Preset.silk();
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// STEP 1 — SERVICE RECONCILIATION DECISIONS
// =============================================================================
//
// Modules examined from ../lint-staged/package/src/ vs existing silk-effects:
//
//   utils/Command.ts — COPIED
//     Provides `Command` (static utility class), `PackageManager` type, and
//     `ToolSearchResult` interface. Uses synchronous Node.js APIs (child_process,
//     fs, path) with an in-memory cache. Substantially different from silk-effects'
//     `ToolDiscovery` Effect service (which uses Effect + Schema for async tool
//     resolution). The sync API is required by lint-staged handlers which must
//     return synchronous command strings. Not replacing with ToolDiscovery.
//
//   utils/Workspace.ts — COPIED
//     Wraps workspaces-effect synchronous APIs (findWorkspaceRootSync,
//     getWorkspacePackagesSync) with module-level caching. silk-effects'
//     SilkWorkspaceAnalyzer is Effect-based and async; no sync equivalent exists.
//     The handlers need synchronous workspace root discovery, so this cannot
//     be replaced. Copied as-is.
//
//   utils/Filter.ts — COPIED
//     Static utility class for filtering and shell-escaping file lists. No
//     equivalent in silk-effects. Lint-specific and platform-agnostic.
//
//   handlers/* — COPIED
//     All seven handlers (Biome, Markdown, PackageJson, PnpmWorkspace,
//     ShellScripts, TypeScript, Yaml). No equivalent in silk-effects.
//     Handlers use ../utils/Command.ts, ../utils/Filter.ts, ../utils/Workspace.ts
//     which are correct relative to their location in handlers/.
//     Note: handlers use node:fs, node:path, node:child_process builtins directly
//     (via Command.ts) — these are not @effect/platform-node, so silk-effects
//     src remains platform-node-free.
//
//   handlers/Biome.ts schema-sync — NOT DUPLICATED
//     lint-staged's Biome handler does NOT do schema-sync; it only discovers
//     and invokes the biome CLI. The BiomeSchemaSync service (in silk-effects)
//     handles $schema URL validation separately. No overlap.
//
//   config/createConfig.ts — COPIED
//     Factory for composing handler configurations. No equivalent in silk-effects.
//
//   config/Preset.ts — COPIED
//     Standard preset configurations (minimal, standard, silk). No equivalent.
//
//   Handler.ts — COPIED
//     Abstract base class for all handlers. No equivalent in silk-effects.
//
//   types.ts — COPIED
//     All TypeScript type/interface definitions for handlers and config.
//     No equivalent in silk-effects.
//
//   cli/sections.ts — COPIED (import rewritten)
//     Managed section definitions + constants for the savvy-lint init command.
//     Originally imported from @savvy-web/silk-effects; rewired to relative
//     schema paths (SectionBlock, SectionDefinition, savvyToolSection).
//     Included so Phase B's savvy lint init can import section helpers from
//     the Lint namespace.
//
//   cli/templates/markdownlint.gen.ts — COPIED
//     Auto-generated markdownlint config template data consumed by init command.
//     No deps; pure data.
//
//   cli/index.ts, cli/commands/* — NOT COPIED
//     CLI entry point and command implementations are excluded. They will become
//     the savvy lint command group in Phase B (cli package).
//
//   public/biome/silk.jsonc — NOT COPIED
//     The biome config asset lives in the lint-staged build output and is
//     referenced by path from consumer repos. silk-effects does not need to
//     bundle or copy this file; consumers will import it from @savvy-web/silk
//     directly (which re-exports "./biome/silk.jsonc"). The bundler copies only
//     the public/ convention, so no build-config copy entry is needed here.
//
// =============================================================================

// === Abstract base class ===

export { Handler } from "./Handler.js";

// === Handlers ===

export { Biome } from "./handlers/Biome.js";
export { Markdown } from "./handlers/Markdown.js";
export { PackageJson } from "./handlers/PackageJson.js";
export type { PnpmWorkspaceContent } from "./handlers/PnpmWorkspace.js";
export { PnpmWorkspace } from "./handlers/PnpmWorkspace.js";
export { ShellScripts } from "./handlers/ShellScripts.js";
export type { TypeScriptCompiler } from "./handlers/TypeScript.js";
export { TypeScript } from "./handlers/TypeScript.js";
export { Yaml } from "./handlers/Yaml.js";

// === Config ===

export { createConfig } from "./config/createConfig.js";
export type { PresetExtendOptions } from "./config/Preset.js";
export { Preset } from "./config/Preset.js";

// === Types ===

export type {
	BaseHandlerOptions,
	BiomeOptions,
	CreateConfigOptions,
	LintStagedConfig,
	LintStagedEntry,
	LintStagedHandler,
	MarkdownOptions,
	PackageJsonOptions,
	PnpmWorkspaceOptions,
	PresetType,
	ShellScriptsOptions,
	TypeScriptOptions,
	YamlOptions,
} from "./types.js";

// === Utils ===

export type { PackageManager, ToolSearchResult } from "./utils/Command.js";
export { Command } from "./utils/Command.js";
export { Filter } from "./utils/Filter.js";
export type { WorkspacePackageInfo } from "./utils/Workspace.js";
export {
	getWorkspacePackagePaths,
	getWorkspacePackages,
	getWorkspaceRoot,
	isWorkspacePackagePath,
	resetWorkspaceCache,
} from "./utils/Workspace.js";

// === CLI section definitions and templates (consumed by Phase B savvy lint init) ===

export {
	DEFAULT_CONFIG_PATH,
	HUSKY_HOOK_PATH,
	LegacySavvyLintHygieneDef,
	MARKDOWNLINT_CONFIG_PATH,
	POST_CHECKOUT_HOOK_PATH,
	POST_MERGE_HOOK_PATH,
	SavvyLintSectionDef,
	generateManagedContent,
	savvyLintBlock,
} from "./cli/sections.js";

export { MARKDOWNLINT_CONFIG, MARKDOWNLINT_SCHEMA, MARKDOWNLINT_TEMPLATE } from "./cli/templates/markdownlint.gen.js";
