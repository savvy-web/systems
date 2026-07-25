import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
	PostToolUseEnvelope,
	PreToolUseEnvelope,
	SessionStartEnvelope,
} from "../../../src/commitlint/hook/envelope.js";

describe("PreToolUseEnvelope", () => {
	it("decodes a Bash tool envelope", () => {
		const decoded = Schema.decodeUnknownSync(PreToolUseEnvelope)({
			hook_event_name: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "git status" },
		});
		expect(decoded.tool_name).toBe("Bash");
		expect(decoded.tool_input.command).toBe("git status");
	});

	it("decodes an MCP tool envelope (no command field)", () => {
		const decoded = Schema.decodeUnknownSync(PreToolUseEnvelope)({
			hook_event_name: "PreToolUse",
			tool_name: "mcp__github__list_issues",
			tool_input: { owner: "x", repo: "y" },
		});
		expect(decoded.tool_name).toBe("mcp__github__list_issues");
	});

	it("decodes a Read/Write/Edit envelope (file_path field)", () => {
		const decoded = Schema.decodeUnknownSync(PreToolUseEnvelope)({
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_input: { file_path: "/foo/bar.txt", content: "hi" },
		});
		expect(decoded.tool_name).toBe("Write");
	});
});

describe("PostToolUseEnvelope", () => {
	it("decodes a Bash post-tool envelope", () => {
		const decoded = Schema.decodeUnknownSync(PostToolUseEnvelope)({
			hook_event_name: "PostToolUse",
			tool_name: "Bash",
			tool_input: { command: "git commit -m foo" },
			tool_response: { interrupted: false, exit_code: 0, stdout: "", stderr: "" },
		});
		expect(decoded.tool_response.exit_code).toBe(0);
	});
});

describe("SessionStartEnvelope", () => {
	it("decodes", () => {
		const decoded = Schema.decodeUnknownSync(SessionStartEnvelope)({
			hook_event_name: "SessionStart",
			source: "startup",
		});
		expect(decoded.source).toBe("startup");
	});
});
