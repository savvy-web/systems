import { describe, expect, it } from "vitest";
import { createChangeset } from "../src/lib/changeset/index.js";

describe("changeset template", () => {
	it("creates changeset config with defaults", () => {
		const result = createChangeset({});
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("changeset");
		expect(result[0].filename).toBe(".changeset/config.json");

		const parsed = JSON.parse(result[0].content);
		expect(parsed.$schema).toBe("https://unpkg.com/@changesets/config@3.1.1/schema.json");
		expect(parsed.access).toBe("restricted");
		expect(parsed.baseBranch).toBe("main");
		expect(parsed.commit).toBe(false);
	});

	it("uses custom access and baseBranch", () => {
		const result = createChangeset({
			access: "public",
			baseBranch: "develop",
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.access).toBe("public");
		expect(parsed.baseBranch).toBe("develop");
	});

	it("includes changelog config with repo", () => {
		const result = createChangeset({
			repo: "savvy-web/systems",
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.changelog).toEqual(["@savvy-web/changesets/changelog", { repo: "savvy-web/systems" }]);
	});

	it("uses custom changelog module", () => {
		const result = createChangeset({
			changelog: "@changesets/changelog-github",
			repo: "org/repo",
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.changelog[0]).toBe("@changesets/changelog-github");
	});

	it("validates repo format", () => {
		expect(() => createChangeset({ repo: "invalid" })).toThrow();
	});
});
