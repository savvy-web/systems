import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("rspress-builder public assets", () => {
	it("ships a tsconfig preset extending the bundler base with react-jsx", () => {
		const p = `${root}public/tsconfig.json`;
		expect(existsSync(p)).toBe(true);
		const json = JSON.parse(readFileSync(p, "utf-8"));
		expect(json.extends).toBe("./ecma.json");
		expect(json.compilerOptions.jsx).toBe("react-jsx");
	});

	it("ships ambient CSS-module + import.meta.env declarations", () => {
		const p = `${root}public/rspress-env.d.ts`;
		expect(existsSync(p)).toBe(true);
		const dts = readFileSync(p, "utf-8");
		expect(dts).toContain('declare module "*.module.css"');
		expect(dts).toContain('declare module "*.css"');
		expect(dts).toContain("interface ImportMetaEnv");
	});
});
