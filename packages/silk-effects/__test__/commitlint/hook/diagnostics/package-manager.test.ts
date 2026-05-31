import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	detectFromLockfiles,
	detectPackageManager,
	parsePackageManagerField,
} from "../../../../src/commitlint/hook/diagnostics/package-manager.js";

describe("parsePackageManagerField", () => {
	it.each([
		["pnpm@9.0.0", "pnpm"],
		["yarn@1.22.19", "yarn"],
		["bun@1.0.0", "bun"],
		["npm@10.2.0", "npm"],
	])("extracts %s -> %s", (field, expected) => {
		expect(parsePackageManagerField(JSON.stringify({ packageManager: field }))).toBe(expected);
	});

	it("returns null when packageManager is missing", () => {
		expect(parsePackageManagerField(JSON.stringify({}))).toBeNull();
	});

	it("returns null when packageManager is an unknown tool", () => {
		expect(parsePackageManagerField(JSON.stringify({ packageManager: "deno@1.0.0" }))).toBeNull();
	});

	it("returns null when packageManager is not a string", () => {
		expect(parsePackageManagerField(JSON.stringify({ packageManager: 42 }))).toBeNull();
	});

	it("returns null when JSON is malformed", () => {
		expect(parsePackageManagerField("{ not json")).toBeNull();
	});
});

describe("detectFromLockfiles", () => {
	it("prefers pnpm when pnpm-lock.yaml is present", () => {
		expect(detectFromLockfiles({ pnpm: true, yarn: true, bun: true })).toBe("pnpm");
	});

	it("returns yarn when only yarn.lock is present", () => {
		expect(detectFromLockfiles({ pnpm: false, yarn: true, bun: false })).toBe("yarn");
	});

	it("returns bun when only bun.lock is present", () => {
		expect(detectFromLockfiles({ pnpm: false, yarn: false, bun: true })).toBe("bun");
	});

	it("falls back to npm when no lockfile is present", () => {
		expect(detectFromLockfiles({ pnpm: false, yarn: false, bun: false })).toBe("npm");
	});
});

describe("detectPackageManager", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "savvy-pm-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("uses packageManager field when present", async () => {
		await writeFile(join(dir, "package.json"), JSON.stringify({ packageManager: "yarn@1.22.19" }));
		expect(await detectPackageManager(dir)).toBe("yarn");
	});

	it("falls back to lockfile when packageManager field is missing", async () => {
		await writeFile(join(dir, "package.json"), JSON.stringify({}));
		await writeFile(join(dir, "bun.lock"), "");
		expect(await detectPackageManager(dir)).toBe("bun");
	});

	it("falls back to lockfile when package.json is missing", async () => {
		await writeFile(join(dir, "pnpm-lock.yaml"), "");
		expect(await detectPackageManager(dir)).toBe("pnpm");
	});

	it("returns npm when nothing is present", async () => {
		expect(await detectPackageManager(dir)).toBe("npm");
	});
});
