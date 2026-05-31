import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectDCO } from "../../../src/commitlint/detection/dco.js";

describe("detectDCO", () => {
	const testDir = "/tmp/commitlint-dco-test";

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns true when DCO file exists", () => {
		writeFileSync(join(testDir, "DCO"), "Developer Certificate of Origin Version 1.1");
		expect(detectDCO(testDir)).toBe(true);
	});

	it("returns false when DCO file does not exist", () => {
		expect(detectDCO(testDir)).toBe(false);
	});

	it("returns false for empty directory", () => {
		expect(detectDCO(testDir)).toBe(false);
	});

	// Note: This test may pass or fail depending on file system case sensitivity
	// macOS default (APFS) is case-insensitive, Linux ext4 is case-sensitive
	it.skipIf(process.platform === "darwin")("is case-sensitive (dco file should not match)", () => {
		writeFileSync(join(testDir, "dco"), "lowercase");
		expect(detectDCO(testDir)).toBe(false);
	});
});
