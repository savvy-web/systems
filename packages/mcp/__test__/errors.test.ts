import { ToolFailure, ToolRefusal } from "@effected/mcp";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import * as Errors from "../src/errors.js";
import {
	EngineError,
	McpToolError,
	WorkspaceNotFound,
	engineError,
	mapEngineError,
	workspaceNotFound,
} from "../src/errors.js";

describe("errors module surface", () => {
	it("no longer carries its own message or truncation helpers — the kit's ToolFailure owns them", () => {
		expect(Object.keys(Errors)).not.toContain("composeRemediatedMessage");
		expect(Object.keys(Errors)).not.toContain("truncateEchoed");
		expect(Object.keys(Errors)).not.toContain("ENGINE_ECHO_LIMIT");
		expect(Object.keys(Errors)).not.toContain("Remediation");
	});
});

describe("tagged errors carry ToolFailure fields", () => {
	it("a constructed McpToolError member keeps its remediation, including the kit's suggestedArgs", () => {
		const remediation = {
			hint: "check the task name",
			suggestedTool: "turbo_inspect",
			suggestedArgs: { mode: "graph" },
		};
		const error = new EngineError({
			source: "TurboError",
			message: ToolFailure.message("turbo failed", remediation),
			remediation,
		});
		expect(error.message).toBe("turbo failed check the task name Try turbo_inspect.");
		expect(error.remediation).toEqual(remediation);
		expect(error._tag).toBe("EngineError");
	});
});

describe("workspaceNotFound", () => {
	it("echoes the requested cwd truncated and carries the workspace_info remediation in the message", () => {
		const error = workspaceNotFound(`/x/${"y".repeat(5000)}`);
		expect(error).toBeInstanceOf(WorkspaceNotFound);
		expect(error.message).toContain(ToolFailure.truncate(`/x/${"y".repeat(5000)}`));
		expect(error.message).not.toContain("y".repeat(300));
		expect(error.message).toContain("Try workspace_info.");
		expect(error.cwd).toHaveLength(5003);
	});
});

describe("McpToolError / engineError", () => {
	it("declares the kit's ToolRefusal for a plain refusal, its remediation folded into the message", () => {
		const refusal = ToolRefusal.refuse("no such directory.", { hint: "Pass an existing changeset dir." });
		expect(Schema.is(McpToolError)(refusal)).toBe(true);
		expect(refusal.message).toBe("no such directory. Pass an existing changeset dir.");
	});

	it("engineError keeps the engine tag as source and composes the engine's own message", () => {
		const error = engineError({ _tag: "TurboError", message: "turbo exited 2" }, { hint: "Run turbo by hand." });
		expect(error.source).toBe("TurboError");
		expect(error.message).toBe("turbo exited 2 Run turbo by hand.");
	});

	it("engineError appends the message of an Error cause the engine's one-line rendering omits", () => {
		const error = engineError(
			{
				_tag: "CatalogAssemblyError",
				message: "Failed to assemble catalogs from hooks @effected/pnpm-plugin-effect",
				cause: new Error("config dependency @effected/pnpm-plugin-effect@0.11.1 is not installed"),
			},
			{ hint: "Retry." },
		);
		expect(error.message).toBe(
			"Failed to assemble catalogs from hooks @effected/pnpm-plugin-effect: config dependency @effected/pnpm-plugin-effect@0.11.1 is not installed Retry.",
		);
	});

	it("engineError ignores a non-Error cause", () => {
		const error = engineError({ _tag: "GitError", message: "git failed", cause: "opaque" }, { hint: "Retry." });
		expect(error.message).toBe("git failed Retry.");
	});
});

describe("engineError echo bound", () => {
	it("truncates a pathological engine message (which embeds caller values) at the kit's ENGINE_ECHO_LIMIT", () => {
		const base = "x".repeat(50_000);
		const error = engineError(
			{ _tag: "GitError", message: `git command failed in /repo: git merge-base ${base}\nfatal: bad revision` },
			{ hint: "Retry." },
		);
		expect(error.message.length).toBeLessThan(ToolFailure.ENGINE_ECHO_LIMIT + 50);
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
