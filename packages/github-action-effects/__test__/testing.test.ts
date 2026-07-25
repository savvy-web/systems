import { beforeEach, describe, expect, it, vi } from "@effect/vitest";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("testing entry point", () => {
	it("can be imported and has key exports", async () => {
		const testingModule = await import("../src/testing.js");
		// Spot-check key exports
		expect(testingModule.ActionLogger).toBeDefined();
		expect(testingModule.ActionOutputs).toBeDefined();
		expect(testingModule.ActionInputError).toBeDefined();
		expect(testingModule.ActionsRuntime).toBeDefined();
		expect(testingModule.ActionsConfigProvider).toBeDefined();
		expect(testingModule.ActionsLogger).toBeDefined();
		expect(testingModule.GithubMarkdown).toBeDefined();
	});

	it("does not export deleted services", async () => {
		const testingModule = await import("../src/testing.js");
		expect(testingModule).not.toHaveProperty("ActionsCoreLive");
		expect(testingModule).not.toHaveProperty("ActionsGitHubLive");
		expect(testingModule).not.toHaveProperty("ActionsCacheLive");
		expect(testingModule).not.toHaveProperty("ActionsExecLive");
		expect(testingModule).not.toHaveProperty("ActionsToolCacheLive");
		expect(testingModule).not.toHaveProperty("ActionsPlatformLive");
		expect(testingModule).not.toHaveProperty("ActionInputsLive");
		expect(testingModule).not.toHaveProperty("ActionInputsTest");
		expect(testingModule).not.toHaveProperty("ActionsCore");
		expect(testingModule).not.toHaveProperty("ActionsExec");
		expect(testingModule).not.toHaveProperty("ActionsGitHub");
		expect(testingModule).not.toHaveProperty("ActionsToolCache");
		expect(testingModule).not.toHaveProperty("ActionInputs");
	});
});
