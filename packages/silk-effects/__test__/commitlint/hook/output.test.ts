import { describe, expect, it } from "vitest";
import {
	postToolUseAdvise,
	preToolUseAdvise,
	preToolUseAllow,
	preToolUseDeny,
	preToolUseSilent,
	sessionStartContext,
	userPromptSubmitContext,
} from "../../../src/commitlint/hook/output.js";

describe("preToolUseAllow", () => {
	it("emits an allow decision", () => {
		expect(preToolUseAllow("ok")).toEqual({
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "allow",
				permissionDecisionReason: "ok",
			},
		});
	});
});

describe("preToolUseDeny", () => {
	it("emits a deny decision with reason", () => {
		expect(preToolUseDeny("forbidden")).toEqual({
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: "forbidden",
			},
		});
	});
});

describe("preToolUseAdvise", () => {
	it("emits additionalContext without a decision", () => {
		expect(preToolUseAdvise("heads up")).toEqual({
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				additionalContext: "heads up",
			},
		});
	});
});

describe("preToolUseSilent", () => {
	it("emits null", () => {
		expect(preToolUseSilent()).toBeNull();
	});
});

describe("sessionStartContext", () => {
	it("wraps a string as additionalContext", () => {
		expect(sessionStartContext("ctx")).toEqual({
			hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "ctx" },
		});
	});
});

describe("postToolUseAdvise", () => {
	it("wraps as additionalContext for PostToolUse", () => {
		expect(postToolUseAdvise("ctx")).toEqual({
			hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "ctx" },
		});
	});
});

describe("userPromptSubmitContext", () => {
	it("wraps as additionalContext for UserPromptSubmit", () => {
		expect(userPromptSubmitContext("ctx")).toEqual({
			hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "ctx" },
		});
	});
});
