import { afterEach, describe, expect, it } from "vitest";
import { COMMIT_TYPES } from "../../../src/commitlint/config/rules.js";
import { CommitlintConfig } from "../../../src/commitlint/index.js";

describe("CommitlintConfig.silk()", () => {
	it("creates valid commitlint config with extends", () => {
		const config = CommitlintConfig.silk({ dco: false });

		expect(config).toHaveProperty("extends");
		expect(config).toHaveProperty("rules");
		expect(config.extends).toContain("@commitlint/config-conventional");
	});

	it("includes all commit types in type-enum rule", () => {
		const config = CommitlintConfig.silk({ dco: false });

		expect(config.rules).toHaveProperty("type-enum");
		const typeEnumRule = config.rules?.["type-enum"] as [number, string, string[]] | undefined;
		expect(typeEnumRule).toBeDefined();
		expect(typeEnumRule?.[0]).toBe(2); // error level
		expect(typeEnumRule?.[1]).toBe("always");
		expect(typeEnumRule?.[2]).toEqual(expect.arrayContaining([...COMMIT_TYPES]));
	});

	it("includes tdd in commit type enum", () => {
		const config = CommitlintConfig.silk({ dco: false });
		const typeEnumRule = config.rules?.["type-enum"] as [number, string, string[]] | undefined;
		expect(typeEnumRule?.[2]).toContain("tdd");
	});

	it("sets body-max-line-length to default of 300", () => {
		const config = CommitlintConfig.silk({ dco: false });

		expect(config.rules?.["body-max-line-length"]).toEqual([2, "always", 300]);
	});

	it("respects custom bodyMaxLineLength option", () => {
		const config = CommitlintConfig.silk({ dco: false, bodyMaxLineLength: 500 });

		expect(config.rules?.["body-max-line-length"]).toEqual([2, "always", 500]);
	});

	it("enables case-insensitive signed-off-by rule when dco is true", () => {
		const config = CommitlintConfig.silk({ dco: true });

		expect(config.rules?.["silk/signed-off-by"]).toBeDefined();
		expect(config.rules?.["silk/signed-off-by"]).toEqual([2, "always"]);
	});

	it("disables signed-off-by rule when dco is false", () => {
		const config = CommitlintConfig.silk({ dco: false });

		expect(config.rules?.["silk/signed-off-by"]).toBeUndefined();
	});

	it("disables scope-enum and enables silk/scope-enum when scopes are provided", () => {
		const config = CommitlintConfig.silk({
			dco: false,
			scopes: ["api", "cli", "core"],
		});

		expect(config.rules?.["scope-enum"]).toEqual([0]);
		expect(config.rules?.["silk/scope-enum"]).toEqual([2, "always"]);
	});

	it("merges additionalScopes with provided scopes (sorted and deduplicated)", () => {
		const config = CommitlintConfig.silk({
			dco: false,
			scopes: ["api", "cli"],
			additionalScopes: ["docs", "deps"],
		});

		// scope-enum is disabled; silk/scope-enum handles validation
		expect(config.rules?.["scope-enum"]).toEqual([0]);
		expect(config.rules?.["silk/scope-enum"]).toEqual([2, "always"]);
		// Single merged plugin object (not two)
		expect((config.plugins as unknown[]).length).toBe(1);
	});

	it("enables silk/tdd-scope when no scopes are configured", () => {
		const config = CommitlintConfig.silk({ dco: false });
		expect(config.rules?.["silk/tdd-scope"]).toEqual([2, "always"]);
		expect(config.rules?.["silk/scope-enum"]).toBeUndefined();
	});

	it("when scopes provided: disables scope-enum and silk/tdd-scope, enables silk/scope-enum", () => {
		const config = CommitlintConfig.silk({ dco: false, scopes: ["api", "cli"] });
		expect(config.rules?.["scope-enum"]).toEqual([0]);
		expect(config.rules?.["silk/tdd-scope"]).toEqual([0]);
		expect(config.rules?.["silk/scope-enum"]).toEqual([2, "always"]);
	});

	it("when scopes provided: uses single merged plugin with silk rules and silk/scope-enum", () => {
		const config = CommitlintConfig.silk({ dco: false, scopes: ["api", "cli"] });
		const plugins = config.plugins as Array<{ rules?: Record<string, unknown> }>;
		expect(plugins.length).toBe(1);
		expect(typeof plugins[0]?.rules?.["silk/scope-enum"]).toBe("function");
		expect(typeof plugins[0]?.rules?.["silk/tdd-scope"]).toBe("function");
		expect(typeof plugins[0]?.rules?.["silk/body-no-markdown"]).toBe("function");
		expect(typeof plugins[0]?.rules?.["silk/signed-off-by"]).toBe("function");
	});

	it("when no scopes: uses silkPlugin directly (single plugin)", () => {
		const config = CommitlintConfig.silk({ dco: false });
		const plugins = config.plugins as Array<{ rules?: Record<string, unknown> }>;
		expect(plugins.length).toBe(1);
		expect(typeof plugins[0]?.rules?.["silk/tdd-scope"]).toBe("function");
		expect(plugins[0]?.rules?.["silk/scope-enum"]).toBeUndefined();
	});

	it("includes prompt configuration", () => {
		const config = CommitlintConfig.silk({ dco: false });

		expect(config.prompt).toBeDefined();
		expect(config.prompt?.settings?.enableMultipleScopes).toBe(true);
		expect(config.prompt?.settings?.scopeEnumSeparator).toBe(",");
	});

	describe("COMMITLINT_SKIP_DCO environment variable", () => {
		const originalEnv = process.env.COMMITLINT_SKIP_DCO;

		afterEach(() => {
			if (originalEnv === undefined) {
				delete process.env.COMMITLINT_SKIP_DCO;
			} else {
				process.env.COMMITLINT_SKIP_DCO = originalEnv;
			}
		});

		it("disables DCO when COMMITLINT_SKIP_DCO=1", () => {
			process.env.COMMITLINT_SKIP_DCO = "1";
			const config = CommitlintConfig.silk({ dco: true });

			expect(config.rules?.["silk/signed-off-by"]).toBeUndefined();
		});

		it("disables DCO when COMMITLINT_SKIP_DCO=true", () => {
			process.env.COMMITLINT_SKIP_DCO = "true";
			const config = CommitlintConfig.silk({ dco: true });

			expect(config.rules?.["silk/signed-off-by"]).toBeUndefined();
		});

		it("does not disable DCO for other values", () => {
			process.env.COMMITLINT_SKIP_DCO = "false";
			const config = CommitlintConfig.silk({ dco: true });

			expect(config.rules?.["silk/signed-off-by"]).toBeDefined();
		});
	});
});
