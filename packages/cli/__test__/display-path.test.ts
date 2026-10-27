import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DisplayPath } from "../src/internal/display-path.js";

describe("DisplayPath.under", () => {
	const cwd = resolve("/work/repo");

	it("shows a file under cwd relative to it", () => {
		expect(DisplayPath.under(cwd, join(cwd, "src", "a.md"))).toBe(join("src", "a.md"));
	});

	it("resolves a relative file against the process cwd before comparing", () => {
		expect(DisplayPath.under(process.cwd(), "docs/a.md")).toBe(join("docs", "a.md"));
	});

	it("keeps a file outside cwd exactly as given", () => {
		const outside = resolve("/elsewhere/a.md");
		expect(DisplayPath.under(cwd, outside)).toBe(outside);
	});

	it("keeps cwd itself as given rather than an empty path", () => {
		expect(DisplayPath.under(cwd, cwd)).toBe(cwd);
	});

	it("treats a name that merely starts with .. as inside cwd", () => {
		expect(DisplayPath.under(cwd, join(cwd, "..notes.md"))).toBe("..notes.md");
	});
});
