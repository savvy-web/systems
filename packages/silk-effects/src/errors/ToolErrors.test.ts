import { describe, expect, it } from "vitest";
import { ToolNotFoundError } from "./ToolNotFoundError.js";
import { ToolResolutionError } from "./ToolResolutionError.js";
import { ToolVersionMismatchError } from "./ToolVersionMismatchError.js";

describe("ToolNotFoundError", () => {
	it("has correct tag", () => {
		const err = new ToolNotFoundError({ name: "biome", reason: "not in PATH" });
		expect(err._tag).toBe("ToolNotFoundError");
	});

	it("has human-readable message", () => {
		const err = new ToolNotFoundError({ name: "biome", reason: "not in PATH" });
		expect(err.message).toBe("Tool not found: biome — not in PATH");
	});
});

describe("ToolResolutionError", () => {
	it("has correct tag", () => {
		const err = new ToolResolutionError({ name: "biome", reason: "version check failed" });
		expect(err._tag).toBe("ToolResolutionError");
	});

	it("has human-readable message", () => {
		const err = new ToolResolutionError({ name: "biome", reason: "version check failed" });
		expect(err.message).toBe("Tool resolution failed: biome — version check failed");
	});
});

describe("ToolVersionMismatchError", () => {
	it("has correct tag", () => {
		const err = new ToolVersionMismatchError({ name: "biome", globalVersion: "1.0.0", localVersion: "2.0.0" });
		expect(err._tag).toBe("ToolVersionMismatchError");
	});

	it("has human-readable message", () => {
		const err = new ToolVersionMismatchError({ name: "biome", globalVersion: "1.0.0", localVersion: "2.0.0" });
		expect(err.message).toBe("Tool version mismatch: biome — global 1.0.0 vs local 2.0.0");
	});
});
