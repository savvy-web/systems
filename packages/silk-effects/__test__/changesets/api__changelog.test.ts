import { describe, expect, it, vi } from "vitest";

import { Changelog } from "../../src/changesets/api/changelog.js";

const { getReleaseLine, getDependencyReleaseLine, makeChangelogFunctions } = vi.hoisted(() => {
	const getReleaseLine = vi.fn().mockResolvedValue("- Mock release line\n");
	const getDependencyReleaseLine = vi.fn().mockResolvedValue("- Mock dep line\n");
	const makeChangelogFunctions = vi.fn(() => ({ getReleaseLine, getDependencyReleaseLine }));
	return { getReleaseLine, getDependencyReleaseLine, makeChangelogFunctions };
});

vi.mock("../../src/changesets/changelog/index.js", () => ({
	default: { getReleaseLine, getDependencyReleaseLine },
	makeChangelogFunctions,
}));

const changeset = {
	id: "test-changeset",
	summary: "Added feature",
	releases: [{ name: "@savvy-web/changesets", type: "minor" as const }],
	commit: "abc1234",
};

describe("Changelog", () => {
	it("formatReleaseLine delegates to getReleaseLine", async () => {
		const result = await Changelog.formatReleaseLine(changeset, "minor", { repo: "owner/repo" });

		expect(result).toBe("- Mock release line\n");
		expect(getReleaseLine).toHaveBeenCalledWith(changeset, "minor", { repo: "owner/repo" });
	});

	it("formatDependencyReleaseLine delegates to getDependencyReleaseLine", async () => {
		const result = await Changelog.formatDependencyReleaseLine([], [], { repo: "owner/repo" });

		expect(result).toBe("- Mock dep line\n");
		expect(getDependencyReleaseLine).toHaveBeenCalledWith([], [], { repo: "owner/repo" });
	});

	it("omitting logMode builds the functions with no options (the stderr default)", async () => {
		makeChangelogFunctions.mockClear();
		await Changelog.formatReleaseLine(changeset, "minor", { repo: "owner/repo" });
		await Changelog.formatDependencyReleaseLine([], [], { repo: "owner/repo" });
		expect(makeChangelogFunctions).toHaveBeenCalledTimes(2);
		expect(makeChangelogFunctions).toHaveBeenNthCalledWith(1, {});
		expect(makeChangelogFunctions).toHaveBeenNthCalledWith(2, {});
	});

	it("routes an explicit logMode into makeChangelogFunctions on both statics", async () => {
		makeChangelogFunctions.mockClear();
		await Changelog.formatReleaseLine(changeset, "minor", { repo: "owner/repo" }, "github");
		await Changelog.formatDependencyReleaseLine([], [], { repo: "owner/repo" }, "silent");
		expect(makeChangelogFunctions).toHaveBeenNthCalledWith(1, { logMode: "github" });
		expect(makeChangelogFunctions).toHaveBeenNthCalledWith(2, { logMode: "silent" });
	});
});
