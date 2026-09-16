import type { Section } from "@effected/templates";
import { CommentStyle, SectionId } from "@effected/templates";

/**
 * Section identity for the OKF bundle sync block.
 *
 * `toolName` is `"savvy-okf"`; pair with {@link savvyOkfSync}.
 *
 * @remarks
 * The key is spelled uppercase because the kit renders it verbatim into the
 * markers (`# --- BEGIN SAVVY-OKF MANAGED SECTION ---`), matching the casing of
 * every other Silk Suite section already written into consumer hook files.
 *
 * @since 0.2.0
 * @public
 */
export const SavvyOkfSection: SectionId = SectionId.make({
	key: "SAVVY-OKF",
	commentStyle: CommentStyle.hash,
});

/**
 * OKF bundle sync shared across Silk Suite `pre-commit` hook files.
 *
 * @remarks
 * Runs `okfit sync --staged` over the repo's `okf/` bundle so the `generated.at`
 * stamp on every staged concept lands in the SAME commit as the edit that moved
 * it, rather than surfacing as drift on the next validate.
 *
 * **Precondition:** a `SavvyBaseSection` block must precede this one in the
 * hook file. Unlike `savvyToolchainCheck` and `savvyInstallDeps`, this block is
 * NOT self-contained — it reads `ROOT`, `in_ci` and `pm_exec` from the
 * preamble, because its only home is `pre-commit`, which always carries it.
 *
 * Three guards keep it a silent no-op where it has nothing to do:
 *
 * - CI, where the checkout is never committed from and the bundle is validated
 *   by its own job.
 * - No `okf/` directory at the repo root — the repo carries no bundle.
 * - No local `okfit` binary. The probe is `-x "$ROOT/node_modules/.bin/okfit"`
 *   rather than `command -v okfit` because the tool runs through `pm_exec`,
 *   which resolves the LOCAL devDependency and never a global install; a
 *   global-only `okfit` would pass `command -v` and then fail under `pm_exec`.
 *   `node_modules/.bin` is common to all four supported package managers, so
 *   one probe covers them.
 *
 * The positional argument is `"$ROOT"`, the PROJECT root `okfit` starts config
 * discovery from — not the bundle directory. Passing `"$ROOT/okf"` makes the
 * tool look for the bundle at `okf/okf` and exit 3.
 *
 * Once it runs, a non-zero exit FAILS the commit (`|| exit 1`): a bundle the
 * tool cannot sync is a broken bundle, and letting the commit through would
 * land it silently. `--staged` re-adds whatever it writes, so the hook needs no
 * `git add` of its own.
 *
 * The default `--staged` modes are `generated` and `index`, so the derived
 * `index.md` files are re-stamped in the same commit too — but only while the
 * bundle is clean apart from what is staged. Index mode reads concepts from
 * DISK, not from the git index, and `--staged` re-adds what it writes, so an
 * untracked or partially staged concept would otherwise let an unrelated
 * commit land an `index.md` entry linking a file that commit does not
 * contain. When `git status --porcelain -- okf` shows any unstaged or
 * untracked entry (second status column non-blank), the hook narrows to
 * `--only generated` for that commit and the index catches up on the next
 * clean one.
 *
 * @returns The sync shell, with no surrounding markers or trailing newline.
 *
 * @since 0.2.0
 * @public
 */
export function savvyOkfSync(): string {
	return `if ! in_ci && [ -d "$ROOT/okf" ] && [ -x "$ROOT/node_modules/.bin/okfit" ]; then
  # Index mode reads concepts from disk, so skip it while okf/ carries untracked or
  # unstaged work: a commit must never link a concept it does not contain.
  if git -C "$ROOT" status --porcelain --untracked-files=all -- okf | grep -q '^.[^ ]'; then
    pm_exec okfit sync --staged --only generated "$ROOT" || exit 1
  else
    pm_exec okfit sync --staged "$ROOT" || exit 1
  fi
fi`;
}

/**
 * Build the OKF bundle sync block for `pre-commit`.
 *
 * @returns A shell `Section` (`commentStyle: hash`) keyed `SAVVY-OKF`.
 *
 * @since 0.2.0
 * @public
 */
export function savvyOkfBlock(): Section {
	return SavvyOkfSection.section(savvyOkfSync());
}
