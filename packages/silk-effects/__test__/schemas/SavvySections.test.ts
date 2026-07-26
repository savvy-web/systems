import { CommentStyle, Section, SectionDialect, SectionId } from "@effected/templates";
import { describe, expect, it } from "vitest";
import {
	SavvyBaseSection,
	SavvyHooksSection,
	savvyBasePreamble,
	savvyHooksHygiene,
	savvyToolSection,
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
