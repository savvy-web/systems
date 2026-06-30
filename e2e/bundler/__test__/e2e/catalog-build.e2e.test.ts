import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureDir } from "./helpers.js";

describe("e2e: catalog: unknown name rejects the build", () => {
	it("a dependency referencing catalog:does-not-exist causes a non-zero exit", () => {
		const cwd = fixtureDir("catalog-unknown");
		rmSync(join(cwd, "dist"), { recursive: true, force: true });
		let stderr = "";
		expect(() => {
			try {
				execFileSync("node", ["savvy.build.ts", "--target", "prod"], { cwd, stdio: "pipe" });
			} catch (err: unknown) {
				const e = err as { stderr?: Buffer };
				stderr = e.stderr?.toString() ?? "";
				throw err;
			}
		}).toThrow();
		// Confirm the failure is catalog-related, not an unrelated error.
		expect(stderr).toMatch(/catalog|resolution|does-not-exist/i);
	}, 60_000);
});

const FIX = fixtureDir("catalog-consumer");

describe("e2e: catalog: and workspace: resolve through a real build", () => {
	it("rewrites catalog:silk and workspace:* to concrete specs in the emitted manifest", () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		execFileSync("node", ["savvy.build.ts", "--target", "prod"], { cwd: FIX, stdio: "pipe" });
		const manifest = JSON.parse(readFileSync(join(FIX, "dist/prod/npm/pkg/package.json"), "utf-8"));
		const serialized = JSON.stringify(manifest);
		expect(serialized).not.toContain("catalog:");
		expect(serialized).not.toContain("workspace:");
		expect(manifest.dependencies.effect).toBe("^3.21.4");
		expect(manifest.dependencies["@fixture/sibling"]).toMatch(/3\.4\.5/);
	}, 60_000);
});

describe("e2e: meta build resolves + optimistic rewrite (real API Extractor)", () => {
	it("emits api model and a fully-resolved, version-bumped meta package.json", () => {
		const meta = fixtureDir("meta-prod");
		rmSync(join(meta, "dist"), { recursive: true, force: true });
		rmSync(join(meta, "models"), { recursive: true, force: true });
		writeFileSync(
			join(meta, "next-versions.json"),
			JSON.stringify({ "@fixture/meta-prod": "2.0.0", "@fixture/tsdown-plugins": "2.0.0" }),
		);
		execFileSync("node", ["savvy.build.ts", "--target", "prod"], { cwd: meta, stdio: "pipe" });
		const metaPkg = JSON.parse(readFileSync(join(meta, "models/package.json"), "utf-8"));
		const serialized = JSON.stringify(metaPkg);
		expect(serialized).not.toMatch(/workspace:/);
		expect(serialized).not.toMatch(/catalog:/);
		expect(metaPkg.version).toBe("2.0.0");
		expect(metaPkg.dependencies["@fixture/tsdown-plugins"]).toBe("2.0.0");
		expect(existsSync(join(meta, "models/meta-prod.api.json"))).toBe(true);
	}, 120_000);
});
