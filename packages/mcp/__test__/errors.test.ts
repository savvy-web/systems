import { describe, expect, it } from "vitest";

import {
	ENGINE_ECHO_LIMIT,
	EngineError,
	InvalidArgument,
	WorkspaceNotFound,
	composeRemediatedMessage,
	engineError,
	invalidArgument,
	mapEngineError,
	truncateEchoed,
	workspaceNotFound,
} from "../src/errors.js";

describe("composeRemediatedMessage", () => {
	it("appends the hint alone when no suggestedTool is given", () => {
		expect(composeRemediatedMessage("turbo failed", { hint: "check the task name" })).toBe(
			"turbo failed check the task name",
		);
	});

	it("appends the hint and a Try <suggestedTool> sentence when suggestedTool is given", () => {
		expect(
			composeRemediatedMessage("turbo failed", { hint: "check the task name", suggestedTool: "turbo_inspect" }),
		).toBe("turbo failed check the task name Try turbo_inspect.");
	});

	it("is what a constructed McpToolError member carries as its own message", () => {
		const remediation = { hint: "check the task name", suggestedTool: "turbo_inspect" };
		const error = new EngineError({
			source: "TurboError",
			message: composeRemediatedMessage("turbo failed", remediation),
			remediation,
		});
		expect(error.message).toBe("turbo failed check the task name Try turbo_inspect.");
		expect(error.remediation).toEqual(remediation);
		expect(error._tag).toBe("EngineError");
	});
});

describe("truncateEchoed", () => {
	it("leaves a value at or under the limit unchanged", () => {
		expect(truncateEchoed("packages/mcp")).toBe("packages/mcp");
	});

	it("truncates a 5,000-character value to 200 characters plus an ellipsis", () => {
		const value = "a".repeat(5000);
		const truncated = truncateEchoed(value);
		expect(truncated).toBe(`${"a".repeat(200)}…`);
		expect(truncated).toHaveLength(201);
	});
});

describe("workspaceNotFound", () => {
	it("echoes the requested cwd truncated and carries the workspace_info remediation in the message", () => {
		const error = workspaceNotFound(`/x/${"y".repeat(5000)}`);
		expect(error).toBeInstanceOf(WorkspaceNotFound);
		expect(error.message).toContain(`/x/${"y".repeat(197)}…`);
		expect(error.message).not.toContain("y".repeat(300));
		expect(error.message).toContain("Try workspace_info.");
		expect(error.cwd).toHaveLength(5003);
	});
});

describe("invalidArgument / engineError", () => {
	it("invalidArgument names the argument and composes the message", () => {
		const error = invalidArgument("dir", "no such directory.", { hint: "Pass an existing changeset dir." });
		expect(error).toBeInstanceOf(InvalidArgument);
		expect(error.argument).toBe("dir");
		expect(error.message).toBe("no such directory. Pass an existing changeset dir.");
	});

	it("engineError keeps the engine tag as source and composes the engine's own message", () => {
		const error = engineError({ _tag: "TurboError", message: "turbo exited 2" }, { hint: "Run turbo by hand." });
		expect(error.source).toBe("TurboError");
		expect(error.message).toBe("turbo exited 2 Run turbo by hand.");
	});
});

describe("engineError echo bound", () => {
	it("truncates a pathological engine message (which embeds caller values) at ENGINE_ECHO_LIMIT", () => {
		const base = "x".repeat(50_000);
		const error = engineError(
			{ _tag: "GitError", message: `git command failed in /repo: git merge-base ${base}\nfatal: bad revision` },
			{ hint: "Retry." },
		);
		expect(ENGINE_ECHO_LIMIT).toBe(2000);
		expect(error.message.length).toBeLessThan(ENGINE_ECHO_LIMIT + 50);
		expect(error.message).toContain("git command failed in /repo");
		expect(error.message).toContain("…");
		expect(error.message.endsWith(" Retry.")).toBe(true);
		expect(error.message).not.toContain("fatal: bad revision");
	});
});

describe("mapEngineError", () => {
	const map = mapEngineError("/somewhere", { hint: "Retry." });

	it("maps the kit's WorkspaceRootNotFoundError to WorkspaceNotFound for the requested cwd", () => {
		const error = map({ _tag: "WorkspaceRootNotFoundError", message: "ignored" });
		expect(error._tag).toBe("WorkspaceNotFound");
		expect(error.message).toContain("/somewhere");
		expect(error.message).not.toContain("ignored");
	});

	it("maps every other engine error to EngineError with the tool's remediation", () => {
		const error = map({ _tag: "GitError", message: "git failed" });
		expect(error._tag).toBe("EngineError");
		expect(error.message).toBe("git failed Retry.");
	});
});
