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
 * change to how `commitlint` is invoked lands for both paths at once. The
 * per-package-manager argv prefix comes from `@effected/commands`'
 * `LocalExec.prefixes`, the kit's single home of that knowledge — except yarn,
 * which the kit no longer supports as a package manager. The commit hooks still
 * run in yarn repositories, so yarn keeps its own `yarn exec` row here.
 *
 * @internal
 */
import { LocalExec } from "@effected/commands";
import type { Commitlint } from "@savvy-web/silk-effects";

/** Yarn's local-binary prefix; the kit's `LocalExec` dropped its yarn row. */
const YARN_EXEC = ["yarn", "exec"] as const;

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
	// The kit's exec prefix runs the project-local binary and never fetches one
	// (`npx --no --`, `bun x --no-install`), so a missing commitlint fails
	// instead of being auto-installed.
	// Every exec prefix is non-empty; the `pm` default only satisfies the index type.
	const prefix = pm === "yarn" ? YARN_EXEC : LocalExec.prefixes(pm).prefix;
	const [command = pm, ...prefixArgs] = prefix;
	return { command, args: [...prefixArgs, ...base] };
}
