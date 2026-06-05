import { describe, expect, it } from "vitest";
import { isTargetObject } from "../../src/targets/config.js";

describe("isTargetObject", () => {
	it("is true only for object target values (not true or string)", () => {
		expect(isTargetObject({ registry: "https://r" })).toBe(true);
		expect(isTargetObject(true)).toBe(false);
		expect(isTargetObject("@scope/x")).toBe(false);
	});
});
