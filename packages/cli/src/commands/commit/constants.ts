/**
 * Shared constants for CLI commands.
 *
 * @internal
 */

/** Husky commit-msg hook path (savvy-base + savvy-commit sections). */
export const HUSKY_HOOK_PATH = ".husky/commit-msg";

/** Husky post-checkout hook path (savvy-hooks hygiene). */
export const POST_CHECKOUT_HOOK_PATH = ".husky/post-checkout";

/** Husky post-merge hook path (savvy-hooks hygiene). */
export const POST_MERGE_HOOK_PATH = ".husky/post-merge";

/** Husky post-commit hook path (savvy-hooks hygiene). */
export const POST_COMMIT_HOOK_PATH = ".husky/post-commit";
