/**
 * Shared managed section definitions and constants for CLI commands.
 *
 * @internal
 */

import type { Section } from "@effected/templates";
import { CommentStyle, SectionId } from "@effected/templates";
import { savvyToolSection } from "../../schemas/SavvySections.js";

/** Path for the husky pre-commit hook. */
export const HUSKY_HOOK_PATH = ".husky/pre-commit";

/** Path for the husky post-checkout hook. */
export const POST_CHECKOUT_HOOK_PATH = ".husky/post-checkout";

/** Path for the husky post-merge hook. */
export const POST_MERGE_HOOK_PATH = ".husky/post-merge";

/** Path for the husky post-commit hook. */
export const POST_COMMIT_HOOK_PATH = ".husky/post-commit";

/** Default path for the lint-staged config file. */
export const DEFAULT_CONFIG_PATH = "lib/configs/lint-staged.config.ts";

/** Path for the markdownlint-cli2 config file. */
export const MARKDOWNLINT_CONFIG_PATH = "lib/configs/.markdownlint-cli2.jsonc";

// The kit renders a section key VERBATIM into its markers, so these keys are
// spelled uppercase to keep emitting the `# --- BEGIN SAVVY-LINT … ---` markers
// already present in consumer repos. See the note on `shellSection` in
// `schemas/SavvySections.ts`.

/** Identity definition for the savvy-lint tool section (read / check / remove). */
export const SavvyLintSectionDef: SectionId = SectionId.make({ key: "SAVVY-LINT", commentStyle: CommentStyle.hash });

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
export const LegacySavvyLintHygieneDef: SectionId = SectionId.make({
	key: "SAVVY-LINT",
	commentStyle: CommentStyle.hash,
});

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
export function savvyLintBlock(configPath: string): Section {
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
