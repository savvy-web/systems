import { beforeEach, describe, expect, it, vi } from "vitest";
import { reminderForPrompt } from "../../src/commands/commit/hooks/user-prompt-submit.js";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

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
