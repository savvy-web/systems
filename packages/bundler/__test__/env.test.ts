import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("bundler ambient env declaration", () => {
	// process.env.__PACKAGE_VERSION__ is injected at build time (target-groups.ts's `define`) and
	// consumed by every CLI that reads its own version, but nothing declared the key — it compiled
	// only because @types/node's ProcessEnv carries a `[key: string]: string | undefined` index
	// signature, so there was no autocomplete and nothing telling a consumer the key exists.
	it("ships an ambient __PACKAGE_VERSION__ declaration as the ./env export", () => {
		const p = `${root}src/env.d.ts`;
		expect(existsSync(p)).toBe(true);
		const dts = readFileSync(p, "utf-8");
		expect(dts).toContain("interface ProcessEnv");
		expect(dts).toContain("__PACKAGE_VERSION__");
		// A global script augments NodeJS.ProcessEnv by declaring the namespace at top level. A
		// `declare global` wrapper here is illegal (TS2669) and silently discards the augmentation
		// under `skipLibCheck`, leaving consumers with no __PACKAGE_VERSION__ member at all.
		expect(dts).not.toContain("declare global");
	});

	it("declares the ./env export as types-only", () => {
		const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf-8"));
		expect(pkg.exports["./env"]).toEqual({ types: "./src/env.d.ts" });
	});
});
