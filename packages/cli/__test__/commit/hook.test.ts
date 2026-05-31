import { beforeEach, describe, expect, it, vi } from "vitest";
import { hookCommand } from "../../src/commands/commit/hook.js";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("hookCommand", () => {
	it("is a defined Effect CLI command", () => {
		expect(hookCommand).toBeDefined();
	});
});
