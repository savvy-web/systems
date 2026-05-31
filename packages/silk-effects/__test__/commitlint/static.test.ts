import { describe, expect, it } from "vitest";
import staticConfig, { COMMIT_TYPES, DCO_SIGNOFF_TEXT } from "../../src/commitlint/static.js";

describe("static config", () => {
	it("extends @commitlint/config-conventional", () => {
		expect(staticConfig.extends).toContain("@commitlint/config-conventional");
	});

	it("includes all commit types", () => {
		const typeEnumRule = staticConfig.rules?.["type-enum"] as [number, string, string[]] | undefined;
		expect(typeEnumRule).toBeDefined();
		expect(typeEnumRule?.[2]).toEqual(expect.arrayContaining([...COMMIT_TYPES]));
	});

	it("includes case-insensitive signed-off-by rule", () => {
		const signoffRule = staticConfig.rules?.["silk/signed-off-by"] as [number, string] | undefined;
		expect(signoffRule).toBeDefined();
		expect(signoffRule?.[0]).toBe(2);
		expect(signoffRule?.[1]).toBe("always");
	});

	it("sets body-max-line-length to 300", () => {
		expect(staticConfig.rules?.["body-max-line-length"]).toEqual([2, "always", 300]);
	});

	it("enables multiple scopes", () => {
		expect(staticConfig.prompt?.settings?.enableMultipleScopes).toBe(true);
	});

	it("enables silk/tdd-scope rule", () => {
		expect(staticConfig.rules?.["silk/tdd-scope"]).toEqual([2, "always"]);
	});
});

describe("exported constants", () => {
	it("exports COMMIT_TYPES", () => {
		expect(COMMIT_TYPES).toContain("feat");
		expect(COMMIT_TYPES).toContain("fix");
		expect(COMMIT_TYPES).toContain("release");
	});

	it("exports DCO_SIGNOFF_TEXT", () => {
		expect(DCO_SIGNOFF_TEXT).toBe("Signed-off-by:");
	});
});
