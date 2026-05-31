import { describe, expect, it, vi } from "vitest";

import { Changelog } from "../../src/changesets/api/changelog.js";

vi.mock("../../src/changesets/changelog/index.js", () => ({
	default: {
		getReleaseLine: vi.fn().mockResolvedValue("- Mock release line\n"),
		getDependencyReleaseLine: vi.fn().mockResolvedValue("- Mock dep line\n"),
	},
}));

describe("Changelog", () => {
	it("formatReleaseLine delegates to getReleaseLine", async () => {
		const changeset = {
			id: "test-changeset",
			summary: "Added feature",
			releases: [{ name: "@savvy-web/changesets", type: "minor" as const }],
			commit: "abc1234",
		};

		const result = await Changelog.formatReleaseLine(changeset, "minor", { repo: "owner/repo" });

		expect(result).toBe("- Mock release line\n");
	});

	it("formatDependencyReleaseLine delegates to getDependencyReleaseLine", async () => {
		const result = await Changelog.formatDependencyReleaseLine([], [], { repo: "owner/repo" });

		expect(result).toBe("- Mock dep line\n");
	});
});
