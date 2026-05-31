import { describe, expect, it } from "vitest";
import { evaluateMessage } from "../../src/commands/commit/hooks/pre-commit-message.js";

describe("evaluateMessage", () => {
	const ctx = {
		branchInfo: { branch: "feat/clarity", inferredTicketId: null },
		openIssues: [],
		autoSignEnabled: false,
	};

	it("returns null for clean messages", async () => {
		const out = await evaluateMessage(`git commit -m "feat(x): add y"`, ctx);
		expect(out).toBeNull();
	});

	it("returns deny output when message has a markdown header", async () => {
		const out = await evaluateMessage(`git commit -m "subject" -m "# Header"`, ctx);
		expect(out).not.toBeNull();
		const hookOutput = out as { hookSpecificOutput: { permissionDecision: string } };
		expect(hookOutput.hookSpecificOutput.permissionDecision).toBe("deny");
	});

	it("returns advise output when message has plan-file references", async () => {
		const out = await evaluateMessage(`git commit -m "subj" -m "see .claude/plans/foo.md"`, ctx);
		expect(out).not.toBeNull();
		const hookOutput = out as { hookSpecificOutput: Record<string, unknown> };
		expect(hookOutput.hookSpecificOutput).toMatchObject({ additionalContext: expect.any(String) });
		expect(hookOutput.hookSpecificOutput).not.toHaveProperty("permissionDecision");
	});

	it("returns null for non-commit commands", async () => {
		expect(await evaluateMessage("ls -la", ctx)).toBeNull();
	});
});
