import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vitest";
import { ToolCommand } from "../../src/utils/ToolCommand.js";

describe("ToolCommand", () => {
	it("wraps a ChildProcess.Command", () => {
		const inner = ChildProcess.make("biome", ["check"]);
		const cmd = new ToolCommand(inner);
		expect(cmd.command).toBe(inner);
	});

	it("env returns new ToolCommand", () => {
		const cmd = new ToolCommand(ChildProcess.make("biome"));
		const withEnv = cmd.env({ FOO: "bar" });
		expect(withEnv).toBeInstanceOf(ToolCommand);
		expect(withEnv).not.toBe(cmd);
	});

	it("workingDirectory returns new ToolCommand", () => {
		const cmd = new ToolCommand(ChildProcess.make("biome"));
		const withCwd = cmd.workingDirectory("/tmp");
		expect(withCwd).toBeInstanceOf(ToolCommand);
		expect(withCwd).not.toBe(cmd);
	});

	it("stdin returns new ToolCommand", () => {
		const cmd = new ToolCommand(ChildProcess.make("biome"));
		const withInput = cmd.stdin("hello");
		expect(withInput).toBeInstanceOf(ToolCommand);
		expect(withInput).not.toBe(cmd);
	});
});
