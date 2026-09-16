import { CommentStyle, Section, SectionDialect, SectionId } from "@effected/templates";
import { describe, expect, it } from "vitest";
import { SavvyOkfSection, savvyOkfBlock, savvyOkfSync } from "../../src/schemas/SavvyOkfSection.js";

/**
 * Markers are rendered by the kit's default dialect. Asserting through it — rather
 * than against a hand-written string — keeps these tests honest about the exact
 * bytes `savvy init` writes into every consumer repo's pre-commit hook.
 */
const dialect = SectionDialect.default;
const rendered = (section: Section): string => {
	const result = dialect.render(section);
	if (result._tag !== "Success") throw new Error(`render failed: ${String(result.failure)}`);
	return result.success;
};

// ── Exact content snapshot (the consumer-facing contract) ──────

const EXPECTED_SYNC = `if ! in_ci && [ -d "$ROOT/okf" ] && [ -x "$ROOT/node_modules/.bin/okfit" ]; then
  pm_exec okfit sync --staged "$ROOT" || exit 1
fi`;

describe("savvyOkfSync", () => {
	it("returns the exact sync content", () => {
		expect(savvyOkfSync()).toBe(EXPECTED_SYNC);
	});

	it("emits no markers and no trailing newline", () => {
		const out = savvyOkfSync();
		expect(out).not.toContain("MANAGED SECTION");
		expect(out.endsWith("\n")).toBe(false);
		expect(out.endsWith("fi")).toBe(true);
	});

	it("runs okfit through pm_exec with --staged and fails the commit on error", () => {
		const out = savvyOkfSync();
		expect(out).toContain('pm_exec okfit sync --staged "$ROOT" || exit 1');
	});

	it("leaves the default --staged modes in place (no --only)", () => {
		expect(savvyOkfSync()).not.toContain("--only");
	});

	it("depends on the savvy-base preamble rather than redefining it", () => {
		const out = savvyOkfSync();
		expect(out).toContain("! in_ci");
		expect(out).toContain('"$ROOT"');
		expect(out).not.toContain("ROOT=$(");
		expect(out).not.toContain("in_ci()");
	});

	it("gates on the LOCAL okfit bin, not a global command", () => {
		const out = savvyOkfSync();
		expect(out).toContain('[ -x "$ROOT/node_modules/.bin/okfit" ]');
		expect(out).not.toContain("command -v");
	});
});

describe("SavvyOkfSection", () => {
	it("is a hash-commented SectionId whose key is the UPPERCASED tool name", () => {
		expect(SavvyOkfSection).toBeInstanceOf(SectionId);
		// The kit renders a key verbatim, so the uppercase spelling here is what
		// keeps the emitted markers consistent with every other savvy section.
		expect(SavvyOkfSection.key).toBe("SAVVY-OKF");
		expect(SavvyOkfSection.commentStyle).toStrictEqual(CommentStyle.hash);
	});

	it("renders the sync inside SAVVY-OKF markers", () => {
		const section = savvyOkfBlock();
		expect(section).toBeInstanceOf(Section);
		expect(section.key).toBe("SAVVY-OKF");
		expect(rendered(section)).toContain("# --- BEGIN SAVVY-OKF MANAGED SECTION ---");
		expect(rendered(section)).toContain("# --- END SAVVY-OKF MANAGED SECTION ---");
		expect(section.content).toBe(EXPECTED_SYNC);
	});
});
