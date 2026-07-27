import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("rspress-builder public assets", () => {
	// The preset is STANDALONE (no `extends`): a consumer resolves it as
	// `@savvy-web/rspress-builder/tsconfig/plugin.json`, and a relative `extends` out of
	// that published path is a resolution hazard. The options a plugin package needs are
	// inlined instead, so the shipped file is self-contained.
	it("ships a self-contained tsconfig/plugin preset with react-jsx", () => {
		const p = `${root}public/tsconfig/plugin.json`;
		expect(existsSync(p)).toBe(true);
		const json = JSON.parse(readFileSync(p, "utf-8"));
		expect(json.extends).toBeUndefined();
		expect(json.compilerOptions.jsx).toBe("react-jsx");
		expect(json.compilerOptions.lib).toEqual(["es2025", "dom"]);
		// Inlined rather than inherited, so the base options must actually be present.
		expect(json.compilerOptions.strict).toBe(true);
		expect(json.compilerOptions.module).toBe("nodenext");
		expect(json.compilerOptions.target).toBe("es2025");
		// The declaration glob agrees with ecma.json's; `types/` holds only `.d.ts`.
		expect(json.include).toContain("${configDir}/types/*.d.ts");
	});

	// The ambient declarations moved from `public/rspress-env.d.ts` to `src/env.d.ts`,
	// published as the `./env` export and copied verbatim into every target dir by the
	// bundler's zero-config ambient-dts path.
	it("ships ambient CSS-module + import.meta.env declarations as the ./env export", () => {
		const p = `${root}src/env.d.ts`;
		expect(existsSync(p)).toBe(true);
		const dts = readFileSync(p, "utf-8");
		expect(dts).toContain('declare module "*.module.css"');
		expect(dts).toContain('declare module "*.css"');
		expect(dts).toContain("interface ImportMetaEnv");
		// A global script augments `ImportMeta` by declaring it at top level. A
		// `declare global` wrapper here is illegal (TS2669) and silently discards the
		// augmentation under `skipLibCheck`, leaving consumers with no `import.meta.env`.
		expect(dts).toContain("interface ImportMeta");
		expect(dts).not.toContain("declare global");
	});

	it("declares the ./env export as types-only", () => {
		const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf-8"));
		expect(pkg.exports["./env"]).toEqual({ types: "./src/env.d.ts" });
	});
});
