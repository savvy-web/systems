// packages/mcp/__test__/resources/tags.test.ts
import { describe, expect, it } from "vitest";

import { canonicalizeTags, loadTagRegistry } from "../../src/resources/tags.js";

describe("tags", () => {
	const registry = { changeset: ["changesets"], lint: ["biome"] };

	it("passes through canonical tags", () => {
		expect(canonicalizeTags(["changeset", "lint"], registry)).toEqual(["changeset", "lint"]);
	});

	it("canonicalizes aliases to their canonical tag", () => {
		expect(canonicalizeTags(["changesets", "biome"], registry)).toEqual(["changeset", "lint"]);
	});

	it("throws on an unknown tag", () => {
		expect(() => canonicalizeTags(["nonsense"], registry)).toThrow(/unknown tag: nonsense/);
	});

	it("loadTagRegistry reads the checked-in registry", () => {
		const reg = loadTagRegistry();
		expect(Object.keys(reg)).toContain("changeset");
	});
});
