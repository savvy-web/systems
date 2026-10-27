// packages/github-action-builder/__test__/services/validation-ci.test.ts
import { describe, expect, it } from "vitest";
import { isCI } from "../../src/services/validation.js";

describe("isCI (strict-mode default)", () => {
	it("is false for an empty environment and for CI=false / CI=0", () => {
		expect(isCI({})).toBe(false);
		expect(isCI({ CI: "false" })).toBe(false);
		expect(isCI({ CI: "0" })).toBe(false);
	});

	it("is true for CI=true, CI=1 and GITHUB_ACTIONS=true", () => {
		expect(isCI({ CI: "true" })).toBe(true);
		expect(isCI({ CI: "1" })).toBe(true);
		expect(isCI({ GITHUB_ACTIONS: "true" })).toBe(true);
	});

	it("is true for another provider's marker or CONTINUOUS_INTEGRATION (changed: the old rule missed both)", () => {
		expect(isCI({ GITLAB_CI: "true" })).toBe(true);
		expect(isCI({ CONTINUOUS_INTEGRATION: "true" })).toBe(true);
	});
});
