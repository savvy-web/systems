import { describe, expect, it } from "vitest";
import { trimTrailingSlashes } from "../../src/utils/TrailingSlash.js";

describe("trimTrailingSlashes", () => {
	it("trims a single trailing slash", () => {
		expect(trimTrailingSlashes("https://registry.npmjs.org/")).toBe("https://registry.npmjs.org");
	});

	it("trims a run of multiple trailing slashes", () => {
		expect(trimTrailingSlashes("a/b///")).toBe("a/b");
	});

	it("preserves interior slash runs", () => {
		expect(trimTrailingSlashes("a//b//c")).toBe("a//b//c");
	});

	it("returns the input unchanged when there is no trailing slash", () => {
		expect(trimTrailingSlashes("a/b/c")).toBe("a/b/c");
	});

	it("returns empty string for empty input", () => {
		expect(trimTrailingSlashes("")).toBe("");
	});

	it("returns empty string for an all-slashes input", () => {
		expect(trimTrailingSlashes("/////")).toBe("");
	});

	it("completes well under a second on a pathological 200,000-slash input (no catastrophic backtracking)", () => {
		const pathological = `${"/".repeat(200_000)}x`;
		const start = performance.now();
		const result = trimTrailingSlashes(pathological);
		const elapsed = performance.now() - start;
		expect(result).toBe(pathological);
		expect(elapsed).toBeLessThan(1000);
	});
});
