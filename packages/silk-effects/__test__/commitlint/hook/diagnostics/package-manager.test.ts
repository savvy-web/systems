import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPackageManager } from "../../../../src/commitlint/hook/diagnostics/package-manager.js";

describe("detectPackageManager", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "savvy-pm-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	const write = (files: Record<string, unknown>) =>
		Promise.all(
			Object.entries(files).map(([name, content]) =>
				writeFile(join(dir, name), typeof content === "string" ? content : JSON.stringify(content)),
			),
		);

	it("uses the packageManager field when present", async () => {
		await write({ "package.json": { packageManager: "yarn@1.22.19" } });
		expect(await detectPackageManager(dir)).toBe("yarn");
	});

	it("prefers devEngines.packageManager over the packageManager field", async () => {
		await write({ "package.json": { devEngines: { packageManager: { name: "bun" } }, packageManager: "pnpm@9.0.0" } });
		expect(await detectPackageManager(dir)).toBe("bun");
	});

	it("lets pnpm-workspace.yaml outrank a manifest field", async () => {
		await write({ "package.json": { packageManager: "yarn@4.0.0" }, "pnpm-workspace.yaml": "" });
		expect(await detectPackageManager(dir)).toBe("pnpm");
	});

	it("detects pnpm from pnpm-lock.yaml when package.json is missing", async () => {
		await write({ "pnpm-lock.yaml": "" });
		expect(await detectPackageManager(dir)).toBe("pnpm");
	});

	it("detects bun from bun.lock when a manifest field names bun", async () => {
		await write({ "package.json": { packageManager: "bun@1.0.0" }, "bun.lock": "" });
		expect(await detectPackageManager(dir)).toBe("bun");
	});

	it("does not trust a bare bun.lock or yarn.lock without a manifest field, falling back to npm", async () => {
		await write({ "package.json": {}, "bun.lock": "", "yarn.lock": "" });
		expect(await detectPackageManager(dir)).toBe("npm");
	});

	it("falls back to npm when the root package.json cannot be parsed", async () => {
		await write({ "package.json": "{ not json", "pnpm-lock.yaml": "" });
		expect(await detectPackageManager(dir)).toBe("npm");
	});

	it("returns npm when nothing is present", async () => {
		expect(await detectPackageManager(dir)).toBe("npm");
	});
});
