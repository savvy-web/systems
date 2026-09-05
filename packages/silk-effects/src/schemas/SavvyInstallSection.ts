import type { Section } from "@effected/templates";
import { CommentStyle, SectionId } from "@effected/templates";

/**
 * The hooks {@link savvyInstallDeps} can be generated for.
 *
 * @remarks
 * Both are needed, and `post-merge` is the one that matters most in practice:
 * a fast-forward `git pull` — the batch-alignment case this exists for — fires
 * `post-merge` and never `post-checkout`. They are separate spellings rather
 * than one argument-sniffing block because the two hooks disagree on both
 * halves of the decision: `post-checkout` is handed `<prev> <new> <flag>` and
 * must ignore a file checkout, while `post-merge` is handed only a squash flag
 * and has to recover its own range from `ORIG_HEAD`.
 *
 * @since 7.4.0
 * @public
 */
export type SavvyInstallHook = "post-checkout" | "post-merge";

/**
 * Section identity for the dependency auto-install block.
 *
 * `toolName` is `"savvy-install"`; pair with {@link savvyInstallDeps}.
 *
 * @since 7.4.0
 * @public
 */
export const SavvyInstallSection: SectionId = SectionId.make({
	key: "SAVVY-INSTALL",
	commentStyle: CommentStyle.hash,
});

/**
 * Pathspecs whose change across a checkout or merge means `node_modules` is stale.
 *
 * @remarks
 * Git's default pathspec globbing does not stop a wildcard at a slash, so the
 * one nested-manifest entry below covers every workspace manifest at any depth
 * without needing a recursive spelling. Manifests are listed alongside lockfiles
 * because a dependency edit that has not been installed yet moves the manifest
 * first and the lockfile not at all.
 */
const DEPENDENCY_PATHS = [
	"package.json",
	"*/package.json",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"package-lock.json",
	"npm-shrinkwrap.json",
	"yarn.lock",
	"bun.lock",
	"bun.lockb",
]
	.map((path) => `'${path}'`)
	.join(" ");

/**
 * Dependency auto-install shared across Silk Suite hook files.
 *
 * @remarks
 * Brings `node_modules` back in line after a branch switch or a pull, so a batch
 * of repos pulled to align their dependencies does not each need a manual
 * install. Installs with lifecycle scripts skipped — `--ignore-scripts`, or
 * `--mode=skip-build` for Yarn Berry, which dropped the former — because the goal
 * is to get the dependency tree on disk, not to run a full postinstall.
 *
 * **That flag has a cost, and one shape of repo cannot pay it.** Where a package
 * publishes through a built link directory — `publishConfig.directory` with
 * `linkDirectory: true`, which is how this monorepo wires `dist/dev/pkg` — the
 * workspace resolves its own dependencies through a directory that a `prepare`
 * script has to build. Skipping scripts there yields a populated `node_modules`
 * pointing at nothing, so a workspace declaring that combination takes a full
 * install instead. Detection reads the git index, so an untracked manifest does
 * not count: it cannot have arrived with the checkout that triggered the hook.
 *
 * Dropping the flag is narrower than it sounds, because the package managers
 * gate lifecycle scripts themselves — pnpm's `strictDepBuilds` with an
 * `allowBuilds` allowlist being the case in point. Everywhere else the flag
 * stays on, and the hook says on the way out that scripts were skipped rather
 * than leaving it to be discovered.
 *
 * Deliberately self-contained, like `savvyToolchainCheck`: its homes carry
 * `SavvyHooksSection` but no `SavvyBaseSection`, so it defines its own root, CI
 * and package-manager lookups rather than depending on `ROOT`, `in_ci` or `PM`.
 *
 * Four guards keep it from firing on the many checkouts that are not dependency
 * events, each a silent no-op:
 *
 * - CI, where the runtime action owns installation by construction.
 * - `SAVVY_SKIP_INSTALL`, the escape hatch for a bisect or a scripted sweep that
 *   does not want an install between steps.
 * - `post-checkout` only: a branch-flag of `0`, which is `git checkout -- <file>`
 *   and not a move between commits.
 * - **The gate that makes this affordable:** nothing dependency-related actually
 *   changed across the move. Without it every branch switch would pay for a full
 *   install. A missing `node_modules` overrides it, since there is nothing to be
 *   stale.
 *
 * A fresh clone is not among the cases it handles, and cannot be: husky sets
 * `core.hooksPath` from its own `prepare` script, so until the first manual
 * install has run there is no hook installed to fire.
 *
 * The install's exit status is swallowed and its output goes to stderr. Git
 * ignores what `post-checkout` and `post-merge` return, so a failure here must
 * not look like a failed checkout; the hint names the escape hatch instead.
 *
 * Every probe that can legitimately fail — no `ORIG_HEAD` to compare against, an
 * unresolvable range — is neutralised with `|| true` rather than left to its own
 * status. These blocks are co-owned and consumer content can sit below them, so
 * under a hook running `set -e` a bare failing substitution would abort the whole
 * file and take those later sections with it.
 *
 * @param hook - Which hook the block is being generated for; decides the
 *   argument guard and how the comparison range is recovered.
 * @returns The install shell, with no surrounding markers or trailing newline.
 *
 * @since 7.4.0
 * @public
 */
export function savvyInstallDeps(hook: SavvyInstallHook): string {
	const skip = `! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$SAVVY_SKIP_INSTALL" ]; }`;
	// post-checkout is handed the pair directly and must ignore a file checkout;
	// post-merge gets no shas at all, so the pre-merge tip comes from ORIG_HEAD —
	// absent (a merge that never recorded one) reads as "no range", not as an error.
	const guard = hook === "post-checkout" ? `${skip} && [ "$3" = "1" ]` : skip;
	const range =
		hook === "post-checkout"
			? `  install_from="$1"
  install_to="$2"`
			: `  install_from=$(git rev-parse --verify --quiet ORIG_HEAD 2>/dev/null) || true
  install_to="HEAD"`;

	return `if ${guard}; then
  install_root=$(git rev-parse --show-toplevel 2>/dev/null) || true
${range}
  install_pm=""
  if [ -n "$install_root" ] && [ -f "$install_root/package.json" ]; then
    if command -v jq >/dev/null 2>&1; then
      install_pm=$(jq -r '.packageManager // empty' "$install_root/package.json" 2>/dev/null | cut -d'@' -f1)
    fi
    if [ -z "$install_pm" ]; then
      if   [ -f "$install_root/pnpm-lock.yaml" ]; then install_pm="pnpm"
      elif [ -f "$install_root/yarn.lock" ];      then install_pm="yarn"
      elif [ -f "$install_root/bun.lock" ] || [ -f "$install_root/bun.lockb" ]; then install_pm="bun"
      else install_pm="npm"; fi
    fi
  fi
  # Nothing to bring up to date unless a manifest or lockfile actually moved.
  # A missing node_modules skips the diff outright: there is no tree to be stale.
  install_stale=""
  if [ -n "$install_pm" ]; then
    if [ ! -d "$install_root/node_modules" ]; then
      install_stale=1
    elif [ -n "$install_from" ] && [ -n "$install_to" ]; then
      install_stale=$(git diff --name-only "$install_from" "$install_to" -- ${DEPENDENCY_PATHS} 2>/dev/null | head -n 1) || true
    fi
  fi
  if [ -n "$install_stale" ] && command -v "$install_pm" >/dev/null 2>&1; then
    # A workspace that publishes through a BUILT link directory resolves its own
    # workspace dependencies through a directory a lifecycle script has to produce.
    # Skipping scripts there leaves node_modules pointing at nothing, which is worse
    # than a slower install, so those repos take the scripts. Read from the index
    # rather than the working tree: a file git does not track cannot have arrived
    # with the checkout that triggered this.
    install_linked=""
    if command -v jq >/dev/null 2>&1; then
      install_linked=$(git -C "$install_root" ls-files -z -- '*package.json' 2>/dev/null \
        | xargs -0 jq -r 'select(.publishConfig.directory and .publishConfig.linkDirectory == true) | input_filename' 2>/dev/null \
        | head -n 1) || true
    fi
    if [ -n "$install_linked" ]; then
      install_flag=""
    else
      # Berry dropped --ignore-scripts for the install mode; Classic never knew the
      # mode. An unreadable major reads as Berry, the likelier of the two today.
      install_flag="--ignore-scripts"
      if [ "$install_pm" = "yarn" ]; then
        case "$(yarn --version 2>/dev/null | cut -d. -f1)" in
          1) ;;
          *) install_flag="--mode=skip-build" ;;
        esac
      fi
    fi
    # ':+' so a full install announces itself as "pnpm install", not "pnpm install ".
    printf '↻ dependencies changed, running %s install%s\\n' "$install_pm" "\${install_flag:+ $install_flag}" >&2
    # Unquoted on purpose: empty must expand to NO argument rather than an empty
    # one. Safe because every value is a static flag literal from this generator.
    if ( cd "$install_root" && "$install_pm" install $install_flag ) >&2; then
      if [ -n "$install_flag" ]; then
        printf '  Lifecycle scripts were skipped. Run a full install if you need build outputs.\\n' >&2
      fi
    else
      printf '⚠ %s install failed; run it yourself to see why.\\n' "$install_pm" >&2
      printf '  Set SAVVY_SKIP_INSTALL=1 to stop this hook from trying.\\n' >&2
    fi
  fi
  unset install_root install_from install_to install_pm install_stale install_linked install_flag
fi`;
}

/**
 * Build the dependency auto-install block for `hook`.
 *
 * @param hook - Which hook the section is destined for.
 * @returns A shell `Section` (`commentStyle: hash`) keyed `SAVVY-INSTALL`.
 *
 * @since 7.4.0
 * @public
 */
export function savvyInstallBlock(hook: SavvyInstallHook): Section {
	return SavvyInstallSection.section(savvyInstallDeps(hook));
}
