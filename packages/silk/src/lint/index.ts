/**
 * Lint config-integration shim for \@savvy-web/silk.
 *
 * Drop-in replacement for the root \@savvy-web/lint-staged export.
 * Re-exports the full consumer-facing surface from the Lint namespace in
 * \@savvy-web/silk-effects so that a lint-staged.config.ts that imported from
 * \@savvy-web/lint-staged works unchanged against \@savvy-web/silk/lint.
 *
 * Intentionally omitted (not re-exported):
 *   - checkCommand, fmtCommand, initCommand, rootCommand, runCli
 *     These are \@effect/cli-based CLI commands from cli/index.ts, which was
 *     explicitly excluded from the Lint namespace (Phase A decision). They
 *     will become the savvy lint command group in the \@savvy-web/cli Phase B
 *     package. A lint-staged.config consumer never imports these.
 *
 * @packageDocumentation
 */

import { Lint } from "@savvy-web/silk-effects";

export type { ConfigLocation } from "@savvy-web/silk-effects";
export { ConfigDiscovery, ConfigDiscoveryLive } from "@savvy-web/silk-effects";

// === Abstract base class ===

export const Handler = Lint.Handler;
export type Handler = typeof Lint.Handler;

// === Handlers ===

export const Biome = Lint.Biome;
export type Biome = typeof Lint.Biome;

export const Markdown = Lint.Markdown;
export type Markdown = typeof Lint.Markdown;

export const PackageJson = Lint.PackageJson;
export type PackageJson = typeof Lint.PackageJson;

export const PnpmWorkspace = Lint.PnpmWorkspace;
export type PnpmWorkspace = typeof Lint.PnpmWorkspace;
export type PnpmWorkspaceContent = Lint.PnpmWorkspaceContent;

export const ShellScripts = Lint.ShellScripts;
export type ShellScripts = typeof Lint.ShellScripts;

export const TypeScript = Lint.TypeScript;
export type TypeScript = typeof Lint.TypeScript;
export type TypeScriptCompiler = Lint.TypeScriptCompiler;

export const Yaml = Lint.Yaml;
export type Yaml = typeof Lint.Yaml;

// === Config ===

export const createConfig = Lint.createConfig;
export type CreateConfigOptions = Lint.CreateConfigOptions;

export const Preset = Lint.Preset;
export type Preset = typeof Lint.Preset;
export type PresetExtendOptions = Lint.PresetExtendOptions;

// === Types ===

export type BaseHandlerOptions = Lint.BaseHandlerOptions;
export type BiomeOptions = Lint.BiomeOptions;
export type LintStagedConfig = Lint.LintStagedConfig;
export type LintStagedEntry = Lint.LintStagedEntry;
export type LintStagedHandler = Lint.LintStagedHandler;
export type MarkdownOptions = Lint.MarkdownOptions;
export type PackageJsonOptions = Lint.PackageJsonOptions;
export type PnpmWorkspaceOptions = Lint.PnpmWorkspaceOptions;
export type PresetType = Lint.PresetType;
export type ShellScriptsOptions = Lint.ShellScriptsOptions;
export type TypeScriptOptions = Lint.TypeScriptOptions;
export type YamlOptions = Lint.YamlOptions;

// === Utils ===

export const Command = Lint.Command;
export type PackageManager = Lint.PackageManager;
export type ToolSearchResult = Lint.ToolSearchResult;

export const Filter = Lint.Filter;

export const getWorkspaceRoot = Lint.getWorkspaceRoot;
export const getWorkspacePackages = Lint.getWorkspacePackages;
export const getWorkspacePackagePaths = Lint.getWorkspacePackagePaths;
export const isWorkspacePackagePath = Lint.isWorkspacePackagePath;
export const resetWorkspaceCache = Lint.resetWorkspaceCache;
export type WorkspacePackageInfo = Lint.WorkspacePackageInfo;

// === CLI section definitions and templates ===

export const DEFAULT_CONFIG_PATH = Lint.DEFAULT_CONFIG_PATH;
export const HUSKY_HOOK_PATH = Lint.HUSKY_HOOK_PATH;
export const LegacySavvyLintHygieneDef = Lint.LegacySavvyLintHygieneDef;
export const MARKDOWNLINT_CONFIG_PATH = Lint.MARKDOWNLINT_CONFIG_PATH;
export const POST_CHECKOUT_HOOK_PATH = Lint.POST_CHECKOUT_HOOK_PATH;
export const POST_MERGE_HOOK_PATH = Lint.POST_MERGE_HOOK_PATH;
export const SavvyLintSectionDef = Lint.SavvyLintSectionDef;
export const generateManagedContent = Lint.generateManagedContent;
export const savvyLintBlock = Lint.savvyLintBlock;

export const MARKDOWNLINT_CONFIG = Lint.MARKDOWNLINT_CONFIG;
export const MARKDOWNLINT_SCHEMA = Lint.MARKDOWNLINT_SCHEMA;
export const MARKDOWNLINT_TEMPLATE = Lint.MARKDOWNLINT_TEMPLATE;
