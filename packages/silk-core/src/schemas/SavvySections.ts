import type { Section } from "@effected/templates";
import { CommentStyle, SectionId } from "@effected/templates";

/**
 * Build a shell-hook section identity from a Silk tool name.
 *
 * @remarks
 * **The key is uppercased here, and that is load-bearing.** The kit renders a
 * key verbatim into its markers (`# --- BEGIN <key> MANAGED SECTION ---`),
 * while the section model this replaces uppercased `toolName` on the way in. A
 * lowercase key would therefore emit `# --- BEGIN savvy-base MANAGED SECTION ---`
 * and no longer match the `SAVVY-BASE` markers already written into every
 * consumer repo's hook files — `check` would report the section absent and
 * `sync` would append a second copy beside the first. Uppercasing keeps the
 * marker bytes identical across the migration.
 */
const shellSection = (toolName: string): SectionId =>
	SectionId.make({ key: toolName.toUpperCase(), commentStyle: CommentStyle.hash });

/**
 * Section identity for the shared package-manager preamble.
 *
 * `toolName` is `"savvy-base"`; pair with {@link savvyBasePreamble} to build the block:
 *
 * @example
 * ```ts
 * const section = SavvyBaseSection.section(savvyBasePreamble());
 * ```
 *
 * @since 0.5.0
 * @public
 */
export const SavvyBaseSection: SectionId = shellSection("savvy-base");

/**
 * Section identity for the shared repo-hygiene block.
 *
 * `toolName` is `"savvy-hooks"`; pair with {@link savvyHooksHygiene}.
 *
 * @since 0.5.0
 * @public
 */
export const SavvyHooksSection: SectionId = shellSection("savvy-hooks");

/**
 * Package-manager detection preamble shared across Silk Suite hook files.
 *
 * @remarks
 * Side-effect-free definitions meant to run unconditionally — no markers, no outer CI
 * guard. Defines `ROOT`, the `in_ci` predicate, `PM` (via `detect_pm`), and `pm_exec`.
 * `pm_exec` uses local/exec semantics for every package manager and `bun x` (space form),
 * which works regardless of how bun was installed (the `bunx` shim is not always on PATH).
 *
 * @returns The preamble shell, with no surrounding markers or trailing newline.
 *
 * @since 0.5.0
 * @public
 */
export function savvyBasePreamble(): string {
	return `ROOT=$(git rev-parse --show-toplevel)

in_ci() { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }

detect_pm() {
  if [ -f "$ROOT/package.json" ]; then
    pm=$(jq -r '.packageManager // empty' "$ROOT/package.json" 2>/dev/null | cut -d'@' -f1)
    if [ -n "$pm" ]; then echo "$pm"; return; fi
  fi
  if   [ -f "$ROOT/pnpm-lock.yaml" ]; then echo "pnpm"
  elif [ -f "$ROOT/yarn.lock" ];      then echo "yarn"
  elif [ -f "$ROOT/bun.lock" ];       then echo "bun"
  else echo "npm"; fi
}
PM=$(detect_pm)

pm_exec() {
  case "$PM" in
    pnpm) pnpm exec "$@" ;;
    yarn) yarn exec "$@" ;;
    bun)  bun x "$@" ;;
    *)    npx --no -- "$@" ;;
  esac
}`;
}

/**
 * Repo-hygiene block shared across Silk Suite hook files.
 *
 * @remarks
 * Self-guarded against CI and needs no package manager: disables Git's `core.fileMode`
 * tracking and marks tracked shell scripts executable.
 *
 * @returns The hygiene shell, with no surrounding markers or trailing newline.
 *
 * @since 0.5.0
 * @public
 */
export function savvyHooksHygiene(): string {
	return `if ! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }; then
  git config core.fileMode false
  git ls-files -z '*.sh' | xargs -0 chmod +x 2>/dev/null || true
fi`;
}

/**
 * Build a consumer's one-line tool section so every consumer calls the shared base
 * helpers identically.
 *
 * @remarks
 * The returned block's content is exactly `in_ci || pm_exec <command>` with `command`
 * appended verbatim — it is not parsed, quoted, or interpolated, so shell tokens like
 * `$ROOT` and `$1` survive into the generated literal.
 *
 * **Precondition:** a {@link SavvyBaseSection} block must precede this section in the same
 * hook file so `in_ci` and `pm_exec` are defined. Consumers guarantee this by passing both
 * to `ManagedSection.syncAll` in order:
 *
 * @example
 * ```ts
 * yield* sections.syncAll(".husky/commit-msg", [
 *   SavvyBaseSection.section(savvyBasePreamble()),
 *   savvyToolSection("savvy-commit", 'commitlint --config "$ROOT/lib/configs/commitlint.config.ts" --edit "$1"'),
 * ]);
 * ```
 *
 * @param toolName - Section identity; also drives the marker names (uppercased).
 * @param command - The command passed verbatim to `pm_exec`, run only outside CI.
 * @returns A shell `Section` (`commentStyle: hash`) for `toolName`.
 *
 * @since 0.5.0
 * @public
 */
export function savvyToolSection(toolName: string, command: string): Section {
	return shellSection(toolName).section(`in_ci || pm_exec ${command}`);
}

/**
 * Section identity for the package-manager toolchain drift check.
 *
 * `toolName` is `"savvy-toolchain"`; pair with {@link savvyToolchainCheck}.
 *
 * @since 7.3.0
 * @public
 */
export const SavvyToolchainSection: SectionId = shellSection("savvy-toolchain");

/**
 * Package-manager drift check shared across Silk Suite hook files.
 *
 * @remarks
 * Compares the running package manager's version against the repo's
 * `devEngines.packageManager` pin and prints a warning on mismatch. **Warn only** —
 * it never blocks the hook and never installs anything, so nobody mid-bisect or
 * mid-rebase on an older pin is stranded.
 *
 * Deliberately self-contained: its homes are `.husky/post-checkout` and
 * `.husky/post-merge`, which carry {@link SavvyHooksSection} but no
 * {@link SavvyBaseSection}, so it defines its own root/CI/pin lookups rather than
 * depending on `ROOT`, `in_ci` or `PM`. It honours the `name` recorded in the pin
 * rather than assuming pnpm.
 *
 * Every input is treated as optional: no `git` root, no `jq`, no `devEngines` block,
 * or a package manager that is not on `PATH` all mean "say nothing". Only an exact
 * pin is comparable, so ranges (`^1.2.3`, `>=1 || <2`) and wildcards (`1.x`) are
 * skipped, and the `+sha512…` integrity tail `devEngines` versions routinely carry is
 * stripped before comparison. Skipped under CI, where the runtime action installs the
 * pin by construction.
 *
 * @returns The drift-check shell, with no surrounding markers or trailing newline.
 *
 * @since 7.3.0
 * @public
 */
export function savvyToolchainCheck(): string {
	return `if ! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }; then
  toolchain_root=$(git rev-parse --show-toplevel 2>/dev/null)
  toolchain_pm=""
  toolchain_pin=""
  if [ -n "$toolchain_root" ] && [ -f "$toolchain_root/package.json" ] && command -v jq >/dev/null 2>&1; then
    toolchain_pm=$(jq -r '.devEngines.packageManager.name // empty' "$toolchain_root/package.json" 2>/dev/null)
    toolchain_pin=$(jq -r '.devEngines.packageManager.version // empty' "$toolchain_root/package.json" 2>/dev/null | cut -d'+' -f1)
  fi
  # Only an exact pin is comparable: drop ranges (^ ~ >= ||) and wildcards (x, *).
  case "$toolchain_pin" in ""|[!0-9]*|*[!0-9A-Za-z.-]*|*x*|*X*) toolchain_pin="" ;; esac
  if [ -n "$toolchain_pm" ] && [ -n "$toolchain_pin" ] && command -v "$toolchain_pm" >/dev/null 2>&1; then
    toolchain_have=$("$toolchain_pm" --version 2>/dev/null | head -n 1 | tr -d '[:space:]')
    # A manager that failed or answered with prose says nothing about drift.
    case "$toolchain_have" in [!0-9]*|*[!0-9A-Za-z.-]*) toolchain_have="" ;; esac
    if [ -n "$toolchain_have" ] && [ "$toolchain_have" != "$toolchain_pin" ]; then
      printf '⚠ %s %s does not match %s, the version pinned in devEngines.packageManager.\\n' "$toolchain_pm" "$toolchain_have" "$toolchain_pin" >&2
      printf '  Lockfiles written by this version may differ from CI. Fix: corepack use %s@%s\\n' "$toolchain_pm" "$toolchain_pin" >&2
    fi
  fi
  unset toolchain_root toolchain_pm toolchain_pin toolchain_have
fi`;
}
