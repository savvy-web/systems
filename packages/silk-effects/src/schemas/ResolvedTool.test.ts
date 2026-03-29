import { Option } from "effect";
import { describe, expect, it } from "vitest";
import { ToolCommand } from "../utils/ToolCommand.js";
import { ResolvedTool } from "./ResolvedTool.js";

describe("ResolvedTool", () => {
	const makeTool = (overrides = {}) =>
		ResolvedTool.make({
			name: "biome",
			source: "local",
			version: Option.some("1.9.0"),
			globalVersion: Option.some("1.8.0"),
			localVersion: Option.some("1.9.0"),
			packageManager: "pnpm",
			mismatch: true,
			...overrides,
		});

	describe("getters", () => {
		it("isLocal", () => {
			expect(makeTool({ source: "local" }).isLocal).toBe(true);
			expect(makeTool({ source: "global" }).isLocal).toBe(false);
		});

		it("isGlobal", () => {
			expect(makeTool({ source: "global" }).isGlobal).toBe(true);
			expect(makeTool({ source: "local" }).isGlobal).toBe(false);
		});

		it("hasVersionMismatch", () => {
			expect(makeTool({ mismatch: true }).hasVersionMismatch).toBe(true);
			expect(makeTool({ mismatch: false }).hasVersionMismatch).toBe(false);
		});
	});

	describe("exec", () => {
		it("returns ToolCommand for global source", () => {
			const tool = makeTool({ source: "global" });
			const cmd = tool.exec("check", "--write");
			expect(cmd).toBeInstanceOf(ToolCommand);
		});

		it("returns ToolCommand for local pnpm", () => {
			const tool = makeTool({ source: "local", packageManager: "pnpm" });
			expect(tool.exec("check")).toBeInstanceOf(ToolCommand);
		});

		it("returns ToolCommand for local npm", () => {
			const tool = makeTool({ source: "local", packageManager: "npm" });
			expect(tool.exec("check")).toBeInstanceOf(ToolCommand);
		});

		it("returns ToolCommand for local bun", () => {
			const tool = makeTool({ source: "local", packageManager: "bun" });
			expect(tool.exec("check")).toBeInstanceOf(ToolCommand);
		});

		it("returns ToolCommand for local yarn", () => {
			const tool = makeTool({ source: "local", packageManager: "yarn" });
			expect(tool.exec("check")).toBeInstanceOf(ToolCommand);
		});
	});

	describe("dlx", () => {
		it("returns ToolCommand for pnpm dlx", () => {
			expect(makeTool({ packageManager: "pnpm" }).dlx("check")).toBeInstanceOf(ToolCommand);
		});

		it("returns ToolCommand for npm dlx", () => {
			expect(makeTool({ packageManager: "npm" }).dlx("check")).toBeInstanceOf(ToolCommand);
		});

		it("returns ToolCommand for bun dlx", () => {
			expect(makeTool({ packageManager: "bun" }).dlx("check")).toBeInstanceOf(ToolCommand);
		});

		it("returns ToolCommand for yarn dlx", () => {
			expect(makeTool({ packageManager: "yarn" }).dlx("check")).toBeInstanceOf(ToolCommand);
		});
	});
});
