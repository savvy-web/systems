import { describe, expect, it } from "vitest";
import { createReadme } from "../src/lib/readme/index.js";

describe("readme template", () => {
	it("creates README with name as h1", () => {
		const result = createReadme({ name: "My Project" });
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("readme");
		expect(result[0].filename).toBe("README.md");
		expect(result[0].content).toContain("# My Project");
	});

	it("includes description", () => {
		const result = createReadme({
			name: "My Project",
			description: "A great project",
		});
		expect(result[0].content).toContain("A great project");
	});

	it("works without description", () => {
		const result = createReadme({ name: "Bare" });
		expect(result[0].content).toBe("# Bare\n");
	});

	it("requires name", () => {
		// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test schema validation
		expect(() => createReadme({} as any)).toThrow();
	});
});
