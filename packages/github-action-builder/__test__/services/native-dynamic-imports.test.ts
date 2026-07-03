/**
 * Tests for the build.nativeDynamicImports rule-regex builder.
 */
import { describe, expect, it } from "vitest";
import {
	buildNativeDynamicImportPathPattern,
	buildNativeDynamicImportRules,
} from "../../src/services/native-dynamic-imports.js";

describe("buildNativeDynamicImportPathPattern", () => {
	it("matches an unscoped package in a flat node_modules layout", () => {
		const pattern = buildNativeDynamicImportPathPattern("fake-dynamic-pkg");
		expect(pattern.test("/project/node_modules/fake-dynamic-pkg/index.mjs")).toBe(true);
	});

	it("matches an unscoped package in a pnpm node_modules layout", () => {
		const pattern = buildNativeDynamicImportPathPattern("fake-dynamic-pkg");
		expect(
			pattern.test("/project/node_modules/.pnpm/fake-dynamic-pkg@1.0.0/node_modules/fake-dynamic-pkg/index.mjs"),
		).toBe(true);
	});

	it("matches a scoped package in a flat node_modules layout", () => {
		const pattern = buildNativeDynamicImportPathPattern("@changesets/apply-release-plan");
		expect(pattern.test("/project/node_modules/@changesets/apply-release-plan/dist/index.js")).toBe(true);
	});

	it("matches a scoped package in a pnpm node_modules layout", () => {
		const pattern = buildNativeDynamicImportPathPattern("@changesets/apply-release-plan");
		expect(
			pattern.test(
				"/project/node_modules/.pnpm/@changesets+apply-release-plan@8.0.0/node_modules/@changesets/apply-release-plan/dist/index.js",
			),
		).toBe(true);
	});

	it("does not match an unrelated package path", () => {
		const pattern = buildNativeDynamicImportPathPattern("fake-dynamic-pkg");
		expect(pattern.test("/project/node_modules/some-other-package/index.js")).toBe(false);
	});

	it("does not match a package name that is only a prefix of the resolved segment", () => {
		const pattern = buildNativeDynamicImportPathPattern("fake-dynamic-pkg");
		expect(pattern.test("/project/node_modules/fake-dynamic-pkg-extended/index.js")).toBe(false);
	});
});

describe("buildNativeDynamicImportRules", () => {
	it("returns no rules for an empty package list", () => {
		expect(buildNativeDynamicImportRules([], "/abs/loader.cjs")).toEqual([]);
	});

	it("returns one rule per configured package pointing at the loader path", () => {
		const rules = buildNativeDynamicImportRules(
			["fake-dynamic-pkg", "@changesets/apply-release-plan"],
			"/abs/loader.cjs",
		);
		expect(rules).toHaveLength(2);
		expect(rules[0]?.use).toEqual([{ loader: "/abs/loader.cjs" }]);
		expect(rules[0]?.test.test("/project/node_modules/fake-dynamic-pkg/index.mjs")).toBe(true);
		expect(rules[1]?.test.test("/project/node_modules/@changesets/apply-release-plan/dist/index.js")).toBe(true);
	});
});
