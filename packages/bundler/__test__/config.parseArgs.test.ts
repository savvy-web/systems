import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/config.js";

describe("parseArgs", () => {
	it("defaults verbose to false", () => {
		expect(parseArgs(["--target", "prod"]).verbose).toBe(false);
	});
	it("sets verbose when --verbose is present", () => {
		expect(parseArgs(["--target", "prod", "--verbose"]).verbose).toBe(true);
	});
});
