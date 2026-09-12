import { describe, expect, it } from "vitest";

import { resolveProjectDir } from "../src/internal/project-root.js";

describe("resolveProjectDir", () => {
	it("prefers a non-empty argv over every env var and cwd", () => {
		const dir = resolveProjectDir(
			["/from/argv"],
			{ SAVVY_MCP_PROJECT_DIR: "/from/env-savvy", CLAUDE_PROJECT_DIR: "/from/env-claude" },
			() => "/from/cwd",
		);
		expect(dir).toBe("/from/argv");
	});

	it("ignores an unresolved placeholder argv and falls through", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal placeholder, not an interpolation bug
		const placeholder = "${SAVVY_MCP_PROJECT_DIR}";
		const dir = resolveProjectDir([placeholder], { SAVVY_MCP_PROJECT_DIR: "/from/env-savvy" }, () => "/from/cwd");
		expect(dir).toBe("/from/env-savvy");
	});

	it("ignores whitespace-only argv and falls through", () => {
		const dir = resolveProjectDir(["   "], { SAVVY_MCP_PROJECT_DIR: "/from/env-savvy" }, () => "/from/cwd");
		expect(dir).toBe("/from/env-savvy");
	});

	it("falls back to SAVVY_MCP_PROJECT_DIR before CLAUDE_PROJECT_DIR when argv is absent", () => {
		const dir = resolveProjectDir(
			[],
			{ SAVVY_MCP_PROJECT_DIR: "/from/env-savvy", CLAUDE_PROJECT_DIR: "/from/env-claude" },
			() => "/from/cwd",
		);
		expect(dir).toBe("/from/env-savvy");
	});

	it("falls back to CLAUDE_PROJECT_DIR when SAVVY_MCP_PROJECT_DIR is absent", () => {
		const dir = resolveProjectDir([], { CLAUDE_PROJECT_DIR: "/from/env-claude" }, () => "/from/cwd");
		expect(dir).toBe("/from/env-claude");
	});

	it("falls back to cwd() when argv and both env vars are absent", () => {
		const dir = resolveProjectDir([], {}, () => "/from/cwd");
		expect(dir).toBe("/from/cwd");
	});
});
