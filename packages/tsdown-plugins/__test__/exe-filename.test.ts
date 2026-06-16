import { describe, expect, it } from "vitest";
import { computeExeFileName } from "../src/exe/filename.js";

describe("computeExeFileName", () => {
	it("suffixes darwin-arm64 with no extension", () => {
		expect(
			computeExeFileName("vitest-agent-sidecar", { platform: "darwin", arch: "arm64", nodeVersion: "25.9.0" }),
		).toBe("vitest-agent-sidecar-darwin-arm64");
	});
	it("suffixes linux-x64 with no extension", () => {
		expect(computeExeFileName("vitest-agent-sidecar", { platform: "linux", arch: "x64", nodeVersion: "25.9.0" })).toBe(
			"vitest-agent-sidecar-linux-x64",
		);
	});
	it("appends .exe on win", () => {
		expect(computeExeFileName("vitest-agent-sidecar", { platform: "win", arch: "x64", nodeVersion: "25.9.0" })).toBe(
			"vitest-agent-sidecar-win-x64.exe",
		);
	});
});
