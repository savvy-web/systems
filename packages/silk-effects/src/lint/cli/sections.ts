/**
 * Shared managed section definitions and constants for CLI commands.
 *
 * @internal
 */

import { savvyToolSection } from "../../schemas/SavvySections.js";
import type { SectionBlock } from "../../schemas/SectionBlock.js";
import { SectionDefinition } from "../../schemas/SectionDefinition.js";

/** Path for the husky pre-commit hook. */
export const HUSKY_HOOK_PATH = ".husky/pre-commit";

/** Path for the husky post-checkout hook. */
export const POST_CHECKOUT_HOOK_PATH = ".husky/post-checkout";

/** Path for the husky post-merge hook. */
export const POST_MERGE_HOOK_PATH = ".husky/post-merge";

/** Default path for the lint-staged config file. */
export const DEFAULT_CONFIG_PATH = "lib/configs/lint-staged.config.ts";

/** Path for the markdownlint-cli2 config file. */
export const MARKDOWNLINT_CONFIG_PATH = "lib/configs/.markdownlint-cli2.jsonc";

// `toolName` is normalized to uppercase when silk-effects builds section markers, so
// `"savvy-lint"` and `"SAVVY-LINT"` both target the same `# --- BEGIN SAVVY-LINT … ---`
// block. Both definitions below use the lowercase form for consistency with the
// silk-effects shared exports (`savvy-base`, `savvy-hooks`).

/** Identity definition for the savvy-lint tool section (read / check / remove). */
export const SavvyLintSectionDef = SectionDefinition.make({ toolName: "savvy-lint" });

/**
 * Identity definition for the legacy `SAVVY-LINT` hygiene section that previously
 * lived in `.husky/post-checkout` and `.husky/post-merge`.
 *
 * @remarks
 * The hygiene block has been replaced by a co-owned `savvy-hooks` section emitted from
 * silk-effects. Use this definition with `ManagedSection.remove` during migration to
 * delete the leftover block from those hooks. The marker matched is identical to
 * `SavvyLintSectionDef`'s; the two definitions are split only by intent (live tool
 * section vs. legacy hygiene block that lives in a different hook).
 */
export const LegacySavvyLintHygieneDef = SectionDefinition.make({ toolName: "savvy-lint" });

/**
 * Build the lint-staged command run inside the savvy-lint tool section.
 *
 * @param configPath - Path to the lint-staged config file (relative to repo root)
 */
function lintStagedCommand(configPath: string): string {
	return `lint-staged --config "$ROOT/${configPath}"`;
}

/**
 * Build the savvy-lint tool section block for the given config path.
 *
 * @remarks
 * Depends on the savvy-base preamble (`in_ci`, `pm_exec`) preceding it in the hook.
 */
export function savvyLintBlock(configPath: string): SectionBlock {
	return savvyToolSection("savvy-lint", lintStagedCommand(configPath));
}

/**
 * Rendered content of the savvy-lint tool section.
 *
 * @remarks
 * Equivalent to `savvyLintBlock(configPath).content`. Retained for the check command
 * and tests.
 *
 * @param configPath - Path to the lint-staged config file
 */
export function generateManagedContent(configPath: string): string {
	return savvyLintBlock(configPath).content;
}
