import { describe, expect, it } from "vitest";
import { sessionStartCommand } from "../../src/commands/commit/hooks/session-start.js";

describe("sessionStartCommand", () => {
	it("is a defined Effect CLI command", () => {
		expect(sessionStartCommand).toBeDefined();
	});
});
