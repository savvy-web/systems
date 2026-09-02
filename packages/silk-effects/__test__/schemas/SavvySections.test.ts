import { CommentStyle, Section, SectionDialect, SectionId } from "@effected/templates";
import { describe, expect, it } from "vitest";
import {
	SavvyBaseSection,
	SavvyHooksSection,
	SavvyToolchainSection,
	savvyBasePreamble,
	savvyHooksHygiene,
	savvyToolSection,
	savvyToolchainCheck,
} from "../../src/schemas/SavvySections.js";

/**
 * Markers are rendered by the kit's default dialect. Asserting through it — rather
 * than against a hand-written string — keeps these tests honest about what the
 * migration actually has to preserve: the exact bytes already written into every
 * consumer repo's hook files.
 */
const dialect = SectionDialect.default;
const rendered = (section: Section): string => {
	const result = dialect.render(section);
	if (result._tag !== "Success") throw new Error(`render failed: ${String(result.failure)}`);
	return result.success;
};

// ── Exact content snapshots (the consumer-facing contract) ──────

const EXPECTED_PREAMBLE = `ROOT=$(git rev-parse --show-toplevel)

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

const EXPECTED_HYGIENE = `if ! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }; then
  git config core.fileMode false
  git ls-files -z '*.sh' | xargs -0 chmod +x 2>/dev/null || true
fi`;

const EXPECTED_TOOLCHAIN = `if ! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }; then
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

describe("savvyBasePreamble", () => {
	it("returns the exact shared preamble content", () => {
		expect(savvyBasePreamble()).toBe(EXPECTED_PREAMBLE);
	});

	it("uses local exec semantics for every package manager", () => {
		const out = savvyBasePreamble();
		expect(out).toContain('pnpm exec "$@"');
		expect(out).toContain('yarn exec "$@"');
		// bun x (space form), not the bunx shim which is not always on PATH
		expect(out).toContain('bun x "$@"');
		expect(out).not.toContain("bunx");
		expect(out).toContain('npx --no -- "$@"');
	});

	it("emits no markers and no outer CI guard", () => {
		const out = savvyBasePreamble();
		expect(out).not.toContain("MANAGED SECTION");
		expect(out.startsWith("ROOT=$(git rev-parse --show-toplevel)")).toBe(true);
		expect(out.endsWith("}")).toBe(true);
	});
});

describe("savvyHooksHygiene", () => {
	it("returns the exact self-guarded hygiene content", () => {
		expect(savvyHooksHygiene()).toBe(EXPECTED_HYGIENE);
	});

	it("is self-guarded and needs no package manager", () => {
		const out = savvyHooksHygiene();
		expect(out).toContain("core.fileMode false");
		expect(out).toContain("chmod +x");
		// Guards itself against CI rather than relying on an in_ci helper.
		expect(out.startsWith("if ! {")).toBe(true);
		expect(out).not.toContain("PM=");
	});
});

describe("savvyToolchainCheck", () => {
	it("returns the exact self-guarded drift-check content", () => {
		expect(savvyToolchainCheck()).toBe(EXPECTED_TOOLCHAIN);
	});

	it("is self-contained — its hooks carry no savvy-base preamble", () => {
		const out = savvyToolchainCheck();
		// post-checkout / post-merge have SAVVY-HOOKS but not SAVVY-BASE, so none of
		// ROOT, in_ci or PM exist by the time this block runs.
		expect(out).not.toContain("in_ci");
		expect(out).not.toContain("$ROOT");
		expect(out).not.toContain("$PM");
		expect(out.startsWith("if ! {")).toBe(true);
		expect(out).toContain("git rev-parse --show-toplevel");
	});

	it("warns without blocking and installs nothing", () => {
		const out = savvyToolchainCheck();
		expect(out).toContain("printf");
		expect(out).not.toContain("exit 1");
		expect(out).not.toContain("install");
		// The last statement is an unset, so the block always leaves status 0.
		expect(out).toContain("unset toolchain_root toolchain_pm toolchain_pin toolchain_have");
	});

	it("honours the declared manager rather than assuming pnpm", () => {
		const out = savvyToolchainCheck();
		expect(out).toContain(".devEngines.packageManager.name");
		expect(out).toContain('"$toolchain_pm" --version');
		expect(out).not.toContain("pnpm --version");
	});

	it("strips the +sha512 integrity tail and skips inexact pins", () => {
		const out = savvyToolchainCheck();
		expect(out).toContain("cut -d'+' -f1");
		// Ranges (^ ~ >=) and wildcards (1.x) are not comparable to a printed version.
		expect(out).toContain('case "$toolchain_pin" in ""|[!0-9]*|*[!0-9A-Za-z.-]*|*x*|*X*)');
	});

	it("is skipped under CI, where the runtime action installs the pin", () => {
		expect(savvyToolchainCheck()).toContain('if ! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }; then');
	});
});

describe("SavvyToolchainSection", () => {
	it("is a hash-commented SectionId whose key is the UPPERCASED tool name", () => {
		expect(SavvyToolchainSection).toBeInstanceOf(SectionId);
		expect(SavvyToolchainSection.key).toBe("SAVVY-TOOLCHAIN");
		expect(SavvyToolchainSection.commentStyle).toStrictEqual(CommentStyle.hash);
	});

	it("renders the drift check inside SAVVY-TOOLCHAIN markers", () => {
		const section = SavvyToolchainSection.section(savvyToolchainCheck());
		expect(section).toBeInstanceOf(Section);
		expect(rendered(section)).toContain("# --- BEGIN SAVVY-TOOLCHAIN MANAGED SECTION ---");
		expect(rendered(section)).toContain("# --- END SAVVY-TOOLCHAIN MANAGED SECTION ---");
		expect(section.content).toBe(EXPECTED_TOOLCHAIN);
	});
});

describe("SavvyBaseSection", () => {
	it("is a hash-commented SectionId whose key is the UPPERCASED tool name", () => {
		expect(SavvyBaseSection).toBeInstanceOf(SectionId);
		// The kit renders a key verbatim, so the uppercase spelling here is what
		// keeps the emitted markers identical to the ones already on disk.
		expect(SavvyBaseSection.key).toBe("SAVVY-BASE");
		expect(SavvyBaseSection.commentStyle).toStrictEqual(CommentStyle.hash);
	});

	it("renders the preamble inside the pre-existing SAVVY-BASE markers", () => {
		const section = SavvyBaseSection.section(savvyBasePreamble());
		expect(section).toBeInstanceOf(Section);
		expect(rendered(section)).toContain("# --- BEGIN SAVVY-BASE MANAGED SECTION ---");
		expect(rendered(section)).toContain("# --- END SAVVY-BASE MANAGED SECTION ---");
		expect(section.content).toBe(EXPECTED_PREAMBLE);
	});
});

describe("SavvyHooksSection", () => {
	it("is a hash-commented SectionId whose key is the UPPERCASED tool name", () => {
		expect(SavvyHooksSection).toBeInstanceOf(SectionId);
		expect(SavvyHooksSection.key).toBe("SAVVY-HOOKS");
		expect(SavvyHooksSection.commentStyle).toStrictEqual(CommentStyle.hash);
	});

	it("renders the hygiene block inside the pre-existing SAVVY-HOOKS markers", () => {
		const section = SavvyHooksSection.section(savvyHooksHygiene());
		expect(rendered(section)).toContain("# --- BEGIN SAVVY-HOOKS MANAGED SECTION ---");
		expect(section.content).toBe(EXPECTED_HYGIENE);
	});
});

describe("savvyToolSection", () => {
	const COMMIT_CMD = 'commitlint --config "$ROOT/lib/configs/commitlint.config.ts" --edit "$1"';
	const LINT_CMD = 'lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"';

	it("builds an `in_ci || pm_exec <command>` shell section for savvy-commit", () => {
		const block = savvyToolSection("savvy-commit", COMMIT_CMD);
		expect(block).toBeInstanceOf(Section);
		expect(block.key).toBe("SAVVY-COMMIT");
		expect(block.commentStyle).toStrictEqual(CommentStyle.hash);
		expect(block.content).toBe(`in_ci || pm_exec ${COMMIT_CMD}`);
	});

	it("builds the same shape for savvy-lint", () => {
		const block = savvyToolSection("savvy-lint", LINT_CMD);
		expect(block.key).toBe("SAVVY-LINT");
		expect(block.content).toBe(`in_ci || pm_exec ${LINT_CMD}`);
	});

	it("appends the command verbatim — $ROOT and $1 survive into the literal shell", () => {
		const block = savvyToolSection("savvy-commit", COMMIT_CMD);
		expect(block.content.startsWith("in_ci || pm_exec ")).toBe(true);
		// No parsing, quoting, or interpolation of the command.
		expect(block.content).toContain('"$ROOT/lib/configs/commitlint.config.ts"');
		expect(block.content).toContain('"$1"');
		expect(block.content.endsWith(COMMIT_CMD)).toBe(true);
	});

	it("renders inside markers derived from the tool name", () => {
		const block = savvyToolSection("savvy-commit", COMMIT_CMD);
		expect(rendered(block)).toContain("# --- BEGIN SAVVY-COMMIT MANAGED SECTION ---");
		expect(rendered(block)).toContain("# --- END SAVVY-COMMIT MANAGED SECTION ---");
	});
});
