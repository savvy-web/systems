import { describe, expect, it } from "vitest";
import { reminderForPrompt } from "../../src/commands/commit/hooks/user-prompt-submit.js";

describe("reminderForPrompt", () => {
	it.each([
		"please commit this",
		"let's ship it",
		"create a pr",
		"open a pull request",
		"amend the last commit",
		"squash these",
		"/finalize",
	])("returns reminder for %s", (p) => {
		expect(reminderForPrompt(p)).not.toBeNull();
	});

	it("returns null for unrelated prompts", () => {
		expect(reminderForPrompt("how do I refactor this function?")).toBeNull();
	});
});
