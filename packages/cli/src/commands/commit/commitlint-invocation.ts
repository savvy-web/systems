/**
 * Shared, pure builder for the package-manager-aware `commitlint` CLI
 * invocation.
 *
 * @remarks
 * Both commit-message validators shell out to the SAME `commitlint` binary
 * so the real Silk preset stays the single source of truth — they differ only
 * in the trailing mode args:
 *
 * - `savvy commit hook post-commit-verify` replays the most recent commit
 *   (`--last`), AFTER it exists.
 * - `savvy commit lint <file>` validates a candidate message file
 *   (`--edit <file>`), BEFORE it is committed.
 *
 * Keeping the builder pure and package-manager-aware in one place means a
 * change to how `commitlint` is invoked lands for both paths at once.
 *
 * @internal
 */
import type { Commitlint } from "@savvy-web/silk-effects";

export interface CommitlintInvocation {
	command: string;
	args: string[];
}

/**
 * Build the `commitlint` invocation for the detected package manager.
 *
 * @param pm - The detected package manager.
 * @param configPath - Explicit `--config` path, or `null` to let commitlint resolve it.
 * @param tail - The mode args, e.g. `["--last"]` or `["--edit", file]`.
 *
 * @internal
 */
export function buildCommitlintInvocation(
	pm: Commitlint.PackageManager,
	configPath: string | null,
	tail: readonly string[],
): CommitlintInvocation {
	const base = configPath ? ["commitlint", "--config", configPath, ...tail] : ["commitlint", ...tail];
	switch (pm) {
		case "pnpm":
			return { command: "pnpm", args: ["exec", ...base] };
		case "yarn":
			return { command: "yarn", args: ["exec", ...base] };
		case "bun":
			return { command: "bunx", args: base };
		case "npm":
			return { command: "npx", args: ["--no", "--", ...base] };
	}
}
