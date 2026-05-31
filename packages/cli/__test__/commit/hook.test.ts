import { describe, expect, it } from "vitest";
import { hookCommand } from "../../src/commands/commit/hook.js";

describe("hookCommand", () => {
	it("is a defined Effect CLI command", () => {
		expect(hookCommand).toBeDefined();
	});
});
