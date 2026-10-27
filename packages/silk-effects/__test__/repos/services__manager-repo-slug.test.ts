import { describe, expect, it } from "vitest";
import { repoSlug } from "../../src/repos/services/manager.js";

describe("repoSlug", () => {
	it("takes the last path segment of an https remote, .git stripped", () => {
		expect(repoSlug("https://github.com/o/n.git")).toBe("n");
	});

	it("takes the last path segment of an scp remote with an owner", () => {
		expect(repoSlug("git@h:o/n.git")).toBe("n");
	});

	it("reads an scp remote with no slash as its repository path, not the whole address", () => {
		expect(repoSlug("git@host:repo.git")).toBe("repo");
	});

	it("drops one trailing slash before the .git suffix", () => {
		expect(repoSlug("https://github.com/o/n.git/")).toBe("n");
	});

	it("handles a local path remote", () => {
		expect(repoSlug("/srv/r.git")).toBe("r");
	});

	it("trims surrounding whitespace before parsing", () => {
		expect(repoSlug("  https://github.com/o/n.git\n")).toBe("n");
	});
});
