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
