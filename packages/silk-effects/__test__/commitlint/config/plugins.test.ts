import { describe, expect, it } from "vitest";
import { createScopeEnumRule, silkPlugin } from "../../../src/commitlint/config/plugins.js";

/**
 * Minimal commit structure for testing rules.
 * Mirrors the Commit type from conventional-commits-parser.
 */
interface TestCommit {
	raw: string;
	header: string;
	type: string | null;
	scope: string | null;
	subject: string | null;
	body: string | null;
	footer: string | null;
	mentions: string[];
	notes: Array<{ title: string; text: string }>;
	references: Array<{ action: string; issue: string }>;
	revert: Record<string, string> | null;
	merge: string | null;
}

/**
 * Create a mock commit object for testing rules.
 */
function createCommit(overrides: Partial<TestCommit> = {}): TestCommit {
	return {
		raw: "",
		header: "",
		type: null,
		scope: null,
		subject: null,
		body: null,
		footer: null,
		mentions: [],
		notes: [],
		references: [],
		revert: null,
		merge: null,
		...overrides,
	};
}

/** Helper to unwrap potentially async rule results */
async function runRule(
	rule: (typeof silkPlugin.rules)[keyof typeof silkPlugin.rules],
	commit: TestCommit,
): Promise<[boolean, string]> {
	// biome-ignore lint/suspicious/noExplicitAny: Test helper, type coercion needed
	const result = await rule(commit as any);
	return [result[0], result[1] ?? ""];
}

describe("silk/body-no-markdown", () => {
	const rule = silkPlugin.rules["silk/body-no-markdown"];

	it("passes for empty body", async () => {
		const commit = createCommit({ body: null });
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("passes for plain text body", async () => {
		const commit = createCommit({
			body: "This is a simple commit message.\n\nIt has multiple paragraphs but no markdown.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("rejects markdown headers", async () => {
		const commit = createCommit({
			body: "## Summary\n\nThis commit adds a feature.",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("headers (#)");
	});

	it("allows bullet lists with dash", async () => {
		const commit = createCommit({
			body: "Changes:\n- Added feature\n- Fixed bug",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("allows bullet lists with asterisk", async () => {
		const commit = createCommit({
			body: "Changes:\n* Added feature\n* Fixed bug",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("rejects numbered lists", async () => {
		const commit = createCommit({
			body: "Steps:\n1. First step\n2. Second step",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("numbered lists (1.)");
	});

	it("rejects code fences", async () => {
		const commit = createCommit({
			body: "Example:\n```typescript\nconst x = 1;\n```",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("code fences");
	});

	it("rejects bold text", async () => {
		const commit = createCommit({
			body: "This is **important** information.",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("bold");
	});

	it("rejects markdown links", async () => {
		const commit = createCommit({
			body: "See [documentation](https://example.com) for details.",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("links");
	});

	it("rejects horizontal rules", async () => {
		const commit = createCommit({
			body: "Section one\n\n---\n\nSection two",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("horizontal rules");
	});

	it("allows single inline code backticks", async () => {
		const commit = createCommit({
			body: "Fixed the `foo` function.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("allows two inline code backticks", async () => {
		const commit = createCommit({
			body: "Changed `foo` to use `bar` instead.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("rejects excessive inline code (more than 2)", async () => {
		const commit = createCommit({
			body: "Changed `foo`, `bar`, and `baz` to use `qux`.",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("excessive inline code");
	});

	it("reports multiple markdown patterns", async () => {
		const commit = createCommit({
			body: "## Summary\n\n- Item one\n- Item two\n\nSee [link](url).",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("headers (#)");
		expect(message).toContain("links");
	});

	it("allows dashes in normal text", async () => {
		const commit = createCommit({
			body: "This is a well-known fix for the foo-bar issue.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("allows asterisks in normal text", async () => {
		const commit = createCommit({
			body: "Performance improved by 2x * faster than before.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("allows a dunder identifier with no internal underscore (regression #103)", async () => {
		const commit = createCommit({
			body: "Reworked the __proto__ accessor for clarity.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("allows two dunder tokens with prose between them (regression #103)", async () => {
		const commit = createCommit({
			body: "The bundler injects __PACKAGE_VERSION__ and reads process.env.__PACKAGE_VERSION__ at build time.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("allows a single __PACKAGE_VERSION__ token", async () => {
		const commit = createCommit({
			body: "We set __PACKAGE_VERSION__ during the build.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("still rejects asterisk bold", async () => {
		const commit = createCommit({
			body: "This is **still** rejected as bold.",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("bold");
	});
});

describe("silk/subject-no-markdown", () => {
	const rule = silkPlugin.rules["silk/subject-no-markdown"];

	it("passes for empty subject", async () => {
		const commit = createCommit({ subject: null });
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("passes for plain text subject", async () => {
		const commit = createCommit({ subject: "add user authentication" });
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("rejects markdown in subject", async () => {
		const commit = createCommit({ subject: "add **important** feature" });
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("bold");
	});

	it("rejects links in subject", async () => {
		const commit = createCommit({ subject: "fix [issue](https://github.com/org/repo/issues/1)" });
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("links");
	});

	it("allows backticks in subject (common for referencing code)", async () => {
		const commit = createCommit({ subject: "fix `handleClick` function" });
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});
});

describe("silk/body-prose-only", () => {
	const rule = silkPlugin.rules["silk/body-prose-only"];

	it("passes for empty body", async () => {
		const commit = createCommit({ body: null });
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("passes for prose paragraphs", async () => {
		const commit = createCommit({
			body: "This commit refactors the authentication module.\n\nThe changes improve performance and readability.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("rejects dash lists", async () => {
		const commit = createCommit({
			body: "Changes:\n- First change\n- Second change",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("prose paragraphs");
	});

	it("rejects asterisk lists", async () => {
		const commit = createCommit({
			body: "Changes:\n* First change\n* Second change",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("prose paragraphs");
	});

	it("rejects bullet point lists", async () => {
		const commit = createCommit({
			body: "Changes:\n• First change\n• Second change",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("prose paragraphs");
	});

	it("rejects numbered lists with period", async () => {
		const commit = createCommit({
			body: "Steps:\n1. First\n2. Second",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("prose paragraphs");
	});

	it("rejects numbered lists with parenthesis", async () => {
		const commit = createCommit({
			body: "Steps:\n1) First\n2) Second",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("prose paragraphs");
	});

	it("rejects numbered lists with colon", async () => {
		const commit = createCommit({
			body: "Steps:\n1: First\n2: Second",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("prose paragraphs");
	});

	it("allows numbers in normal text", async () => {
		const commit = createCommit({
			body: "This fixes issue 123 and improves performance by 50%.",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("allows indented lists (rejects them)", async () => {
		const commit = createCommit({
			body: "Changes:\n  - Indented item\n  - Another item",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("prose paragraphs");
	});
});

describe("silk/signed-off-by", () => {
	const rule = silkPlugin.rules["silk/signed-off-by"];

	it("passes for Signed-off-by with capital S", async () => {
		const commit = createCommit({
			raw: "feat: add feature\n\nSigned-off-by: John Doe <john@example.com>",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("passes for signed-off-by with lowercase s", async () => {
		const commit = createCommit({
			raw: "feat: add feature\n\nsigned-off-by: John Doe <john@example.com>",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("passes for SIGNED-OFF-BY in all caps", async () => {
		const commit = createCommit({
			raw: "feat: add feature\n\nSIGNED-OFF-BY: John Doe <john@example.com>",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("passes for mixed case signoff", async () => {
		const commit = createCommit({
			raw: "feat: add feature\n\nSigned-Off-By: John Doe <john@example.com>",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});

	it("rejects missing signoff", async () => {
		const commit = createCommit({
			raw: "feat: add feature\n\nThis is a regular commit body.",
		});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("signed off");
	});

	it("rejects empty raw message", async () => {
		const commit = createCommit({ raw: "" });
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("signed off");
	});

	it("rejects null raw message", async () => {
		const commit = createCommit({});
		const [valid, message] = await runRule(rule, commit);
		expect(valid).toBe(false);
		expect(message).toContain("signed off");
	});

	it("passes when signoff is in the footer with other trailers", async () => {
		const commit = createCommit({
			raw: "feat: add feature\n\nBody text.\n\nCo-authored-by: Jane <jane@example.com>\nSigned-off-by: John Doe <john@example.com>",
		});
		const [valid] = await runRule(rule, commit);
		expect(valid).toBe(true);
	});
});

describe("silk/tdd-scope", () => {
	const rule = silkPlugin.rules["silk/tdd-scope"];

	it("passes for non-tdd commits", async () => {
		const [valid] = await runRule(rule, createCommit({ type: "feat", scope: null }));
		expect(valid).toBe(true);
	});

	it("passes for tdd with valid scope (numeric goalId + valid state)", async () => {
		const [valid] = await runRule(rule, createCommit({ type: "tdd", scope: "7:green" }));
		expect(valid).toBe(true);
	});

	it("passes for tdd with multi-digit goalId", async () => {
		const [valid] = await runRule(rule, createCommit({ type: "tdd", scope: "12:spike" }));
		expect(valid).toBe(true);
	});

	it("passes for all four valid states", async () => {
		for (const state of ["spike", "red", "green", "refactor"]) {
			const [valid] = await runRule(rule, createCommit({ type: "tdd", scope: `1:${state}` }));
			expect(valid).toBe(true);
		}
	});

	it("fails when tdd scope is absent", async () => {
		const [valid, msg] = await runRule(rule, createCommit({ type: "tdd", scope: null }));
		expect(valid).toBe(false);
		expect(msg).toContain("tdd commits require a scope");
	});

	it("fails when tdd scope is missing state (no colon)", async () => {
		const [valid, msg] = await runRule(rule, createCommit({ type: "tdd", scope: "7" }));
		expect(valid).toBe(false);
		expect(msg).toContain("tdd scope must match");
	});

	it("fails for non-numeric goalId", async () => {
		const [valid, msg] = await runRule(rule, createCommit({ type: "tdd", scope: "not-a-number:green" }));
		expect(valid).toBe(false);
		expect(msg).toContain("not-a-number:green");
	});

	it("fails for invalid state", async () => {
		const [valid, msg] = await runRule(rule, createCommit({ type: "tdd", scope: "7:invalid-state" }));
		expect(valid).toBe(false);
		expect(msg).toContain("7:invalid-state");
	});

	it("fails for arrow notation state", async () => {
		const [valid, msg] = await runRule(rule, createCommit({ type: "tdd", scope: "7:r->g" }));
		expect(valid).toBe(false);
		expect(msg).toContain("7:r->g");
	});
});

describe("createScopeEnumRule", () => {
	const rule = createScopeEnumRule(["api", "cli"]);

	it("passes for valid project scope on non-tdd type", () => {
		// biome-ignore lint/suspicious/noExplicitAny: Test helper, type coercion needed
		const [valid] = rule(createCommit({ type: "feat", scope: "api" }) as any);
		expect(valid).toBe(true);
	});

	it("fails for unknown project scope on non-tdd type", () => {
		// biome-ignore lint/suspicious/noExplicitAny: Test helper, type coercion needed
		const [valid, msg] = rule(createCommit({ type: "feat", scope: "unknown" }) as any);
		expect(valid).toBe(false);
		expect(msg).toContain("scope must be one of: api, cli");
	});

	it("fails when non-tdd commit has no scope", () => {
		// biome-ignore lint/suspicious/noExplicitAny: Test helper, type coercion needed
		const [valid] = rule(createCommit({ type: "feat", scope: null }) as any);
		expect(valid).toBe(false);
	});

	it("passes for valid tdd scope", () => {
		// biome-ignore lint/suspicious/noExplicitAny: Test helper, type coercion needed
		const [valid] = rule(createCommit({ type: "tdd", scope: "7:green" }) as any);
		expect(valid).toBe(true);
	});

	it("passes for all four tdd states", () => {
		for (const state of ["spike", "red", "green", "refactor"]) {
			// biome-ignore lint/suspicious/noExplicitAny: Test helper, type coercion needed
			const [valid] = rule(createCommit({ type: "tdd", scope: `3:${state}` }) as any);
			expect(valid).toBe(true);
		}
	});

	it("fails for invalid tdd scope (non-numeric goalId)", () => {
		// biome-ignore lint/suspicious/noExplicitAny: Test helper, type coercion needed
		const [valid, msg] = rule(createCommit({ type: "tdd", scope: "not-a-number:green" }) as any);
		expect(valid).toBe(false);
		expect(msg).toContain("not-a-number:green");
	});

	it("fails for absent tdd scope", () => {
		// biome-ignore lint/suspicious/noExplicitAny: Test helper, type coercion needed
		const [valid, msg] = rule(createCommit({ type: "tdd", scope: null }) as any);
		expect(valid).toBe(false);
		expect(msg).toContain("tdd commits require a scope");
	});
});
