import { describe, expect, it } from "vitest";

import { parseCommitMessage } from "../../src/changesets/utils/commit-parser.js";

describe("parseCommitMessage", () => {
	it("parses type and description", () => {
		expect(parseCommitMessage("feat: add login endpoint")).toEqual({
			type: "feat",
			description: "add login endpoint",
		});
	});

	it("parses type with scope", () => {
		expect(parseCommitMessage("feat(auth): add login endpoint")).toEqual({
			type: "feat",
			scope: "auth",
			description: "add login endpoint",
		});
	});

	it("parses type with body", () => {
		expect(parseCommitMessage("feat: add feature\n\nThis is the body")).toEqual({
			type: "feat",
			description: "add feature",
			body: "This is the body",
		});
	});

	it("parses breaking change indicator", () => {
		expect(parseCommitMessage("feat!: breaking API change")).toEqual({
			type: "feat",
			breaking: true,
			description: "breaking API change",
		});
	});

	it("parses breaking change with scope", () => {
		expect(parseCommitMessage("refactor(core)!: restructure modules")).toEqual({
			type: "refactor",
			scope: "core",
			breaking: true,
			description: "restructure modules",
		});
	});

	it("handles non-conventional commit", () => {
		expect(parseCommitMessage("Update README")).toEqual({
			description: "Update README",
		});
	});

	it("handles fix type", () => {
		expect(parseCommitMessage("fix: resolve memory leak")).toEqual({
			type: "fix",
			description: "resolve memory leak",
		});
	});

	it("handles multi-line body with blank line separator", () => {
		const msg = "docs: update API reference\n\nAdded new endpoints.\nUpdated examples.";
		expect(parseCommitMessage(msg)).toEqual({
			type: "docs",
			description: "update API reference",
			body: "Added new endpoints.\nUpdated examples.",
		});
	});
});
