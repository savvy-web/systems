import { describe, expect, it } from "vitest";
import { createGitignore } from "../src/lib/gitignore/index.js";

describe("gitignore template", () => {
	it("creates .gitignore with all default sections", () => {
		const result = createGitignore({});
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("gitignore");
		expect(result[0].filename).toBe(".gitignore");

		const content = result[0].content;
		expect(content).toContain("node_modules");
		expect(content).toContain("dist");
		expect(content).toContain(".DS_Store");
		expect(content).toContain(".turbo");
		expect(content).toContain(".env");
	});

	it("includes section headers", () => {
		const content = createGitignore({})[0].content;
		expect(content).toContain("# Node.js");
		expect(content).toContain("# Build artifacts");
		expect(content).toContain("# OS files");
	});

	it("can disable specific sections", () => {
		const content = createGitignore({
			sections: { os: false },
		})[0].content;
		expect(content).not.toContain(".DS_Store");
		expect(content).toContain("node_modules");
	});

	it("can disable env section", () => {
		const content = createGitignore({
			sections: { env: false },
		})[0].content;
		expect(content).not.toContain(".env");
		expect(content).toContain("node_modules");
	});

	it("includes additional patterns", () => {
		const content = createGitignore({
			additional: ["*.log", "temp/"],
		})[0].content;
		expect(content).toContain("*.log");
		expect(content).toContain("temp/");
	});
});
