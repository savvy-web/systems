import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureDir, runFixtureBuild } from "./helpers.js";

describe("e2e: leaf package build", () => {
	it("dev build emits dist/dev/pkg with index.js + index.d.ts + package.json", () => {
		runFixtureBuild("leaf", ["--target", "dev"]);
		const out = join(fixtureDir("leaf"), "dist/dev/pkg");
		expect(existsSync(join(out, "index.js"))).toBe(true);
		expect(existsSync(join(out, "index.d.ts"))).toBe(true);
		const manifest = JSON.parse(readFileSync(join(out, "package.json"), "utf-8"));
		expect(manifest.exports["."]).toEqual({ types: "./index.d.ts", import: "./index.js", default: "./index.js" });
		expect(manifest.exports["./package.json"]).toBe("./package.json");
	}, 120_000);

	it("prod build injects process.env.__PACKAGE_VERSION__", () => {
		runFixtureBuild("leaf", ["--target", "prod"]);
		const code = readFileSync(join(fixtureDir("leaf"), "dist/prod/npm/pkg/index.js"), "utf-8");
		expect(code).toContain("1.2.3");
	}, 120_000);
});

describe("e2e: multi-entry build has no shared runtime chunk", () => {
	it("mirrors source files; both entries import successfully", async () => {
		runFixtureBuild("multi", ["--target", "prod"]);
		const out = join(fixtureDir("multi"), "dist/prod/npm/pkg");
		const files = readdirSync(out);
		expect(files).toContain("index.js");
		expect(files).toContain("other.js");
		expect(files.some((f) => /^chunk-/.test(f))).toBe(false);
		const idx = await import(join(out, "index.js"));
		const oth = await import(join(out, "other.js"));
		expect(idx.a()).toBe(2);
		expect(oth.b()).toBe(4);
	}, 120_000);
});

describe("e2e: multi-target build", () => {
	it("emits one byte-variant folder per distinct name plus the binding", () => {
		runFixtureBuild("multitarget", ["--target", "prod"]);
		const fix = fixtureDir("multitarget");
		const npmPkg = JSON.parse(readFileSync(join(fix, "dist/prod/npm/pkg/package.json"), "utf-8"));
		expect(npmPkg.name).toBe("multitarget-base");
		expect(npmPkg.private).toBe(false);
		const ghPkg = JSON.parse(readFileSync(join(fix, "dist/prod/github/pkg/package.json"), "utf-8"));
		expect(ghPkg.name).toBe("@scope/multitarget-base");
		expect(existsSync(join(fix, "dist/prod/mirror"))).toBe(false);
		const binding = JSON.parse(readFileSync(join(fix, "dist/prod/targets.json"), "utf-8"));
		expect(binding.groups.map((g: { id: string }) => g.id).sort()).toEqual(["github", "npm"]);
		expect(binding.targets.find((t: { id: string }) => t.id === "mirror")?.group).toBe("npm");
		expect(binding.targets.find((t: { id: string }) => t.id === "mirror")?.registry).toBe("https://mirror.test");
		expect(npmPkg.publishConfig).toBeUndefined();
	}, 120_000);
});
