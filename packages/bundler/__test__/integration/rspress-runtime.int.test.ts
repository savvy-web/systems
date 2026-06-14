import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

describe("rspress dual-bundle integration", () => {
	it("emits a node plugin entry + a bundleless browser runtime with CSS modules", async () => {
		const dir = await mkdtemp(join(tmpdir(), "rspress-int-"));
		await mkdir(join(dir, "src/runtime/components/Button"), { recursive: true });
		await mkdir(join(dir, "types"), { recursive: true });
		await writeFile(
			join(dir, "package.json"),
			JSON.stringify({
				name: "rspress-plugin-fixture",
				version: "1.0.0",
				private: true,
				type: "module",
				exports: { ".": "./src/index.ts", "./runtime": "./src/runtime/index.tsx" },
			}),
		);
		await writeFile(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					jsx: "react-jsx",
					module: "esnext",
					moduleResolution: "bundler",
					lib: ["es2023", "dom", "dom.iterable"],
					skipLibCheck: true,
					strict: true,
				},
				include: ["src/**/*.ts", "src/**/*.tsx", "types/**/*.d.ts"],
			}),
		);
		await writeFile(
			join(dir, "types/css.d.ts"),
			`declare module "*.module.css" { const c: Readonly<Record<string,string>>; export default c; }\ndeclare module "*.css" {}\n`,
		);
		await mkdir(join(dir, "src/runtime/components/Orphan"), { recursive: true });
		await writeFile(join(dir, "src/index.ts"), `export const plugin = () => ({ name: "fixture" });\n`);
		await writeFile(join(dir, "src/runtime/index.tsx"), `export { Button } from "./components/Button/index.js";\n`);
		await writeFile(
			join(dir, "src/runtime/components/Button/index.tsx"),
			`import styles from "./index.module.css";\nexport function Button() { return <button className={styles.primaryButton} />; }\n`,
		);
		await writeFile(join(dir, "src/runtime/components/Button/index.module.css"), `.primary-button { color: red; }\n`);
		// Orphan component: referenced by real RSPress plugins ONLY by file path (globalUIComponents /
		// resolve.alias), NEVER re-exported by the runtime barrel. The bundleless runtime sub-package
		// must ship its WHOLE source tree, not just files reachable from the barrel's import graph.
		await writeFile(
			join(dir, "src/runtime/components/Orphan/index.tsx"),
			`import { jsx } from "react/jsx-runtime";\nexport function Orphan() { return jsx("div", {}); }\n`,
		);
		// A test file under the runtime tree: must NOT be compiled into the runtime output.
		await writeFile(
			join(dir, "src/runtime/components/Orphan/index.test.tsx"),
			`export const fixtureSentinel = true;\n`,
		);

		const config = defineBuild({
			meta: false, // keep this test focused on JS+dts emit; meta is covered elsewhere
			overrides: [
				{
					entries: ["./runtime"],
					outSubdir: "runtime",
					platform: "browser",
					css: { modules: { localsConvention: "camelCaseOnly", namedExport: false }, inject: true },
					externals: ["react", "react/jsx-runtime", "@theme", "@rspress/core"],
				},
			],
			define: { "import.meta.env": "import.meta.env" },
		});

		await runBuild(config, { cwd: dir, argv: ["--target", "dev"], writeOutput: () => {} });

		const pkg = join(dir, "dist/dev/pkg");

		// Plugin entry (node, bundled) at root.
		expect(existsSync(join(pkg, "index.js"))).toBe(true);
		expect(existsSync(join(pkg, "index.d.ts"))).toBe(true);
		// Runtime ISOLATED under runtime/.
		expect(existsSync(join(pkg, "runtime/index.js"))).toBe(true);
		expect(existsSync(join(pkg, "runtime/index.d.ts"))).toBe(true);
		expect(existsSync(join(pkg, "runtime/components/Button/index.js"))).toBe(true);
		// Orphan (non-barrel-exported) component MUST emit: the whole runtime subtree ships, not just
		// files reachable from the barrel.
		expect(existsSync(join(pkg, "runtime/components/Orphan/index.js"))).toBe(true);
		// Test files under the runtime tree must NOT compile into the runtime output.
		expect(existsSync(join(pkg, "runtime/components/Orphan/index.test.js"))).toBe(false);
		// dts stayed BUNDLED into a single runtime/index.d.ts — NOT per-file (no per-component .d.ts).
		expect(existsSync(join(pkg, "runtime/components/Orphan/index.d.ts"))).toBe(false);
		// CSS module: locals JS + emitted stylesheet, under runtime/.
		expect(existsSync(join(pkg, "runtime/components/Button/index.module.js"))).toBe(true);
		const hasCss =
			existsSync(join(pkg, "runtime/components/Button/index.css")) ||
			existsSync(join(pkg, "runtime/components/Button/index.module.css"));
		expect(hasCss).toBe(true);
		// inject: the CSS-module locals JS side-effect imports its stylesheet.
		const localsJs = await readFile(join(pkg, "runtime/components/Button/index.module.js"), "utf-8");
		expect(localsJs).toMatch(/import\s+["']\.\/index(\.module)?\.css["']/);
		// react stays external in the component JS.
		const componentJs = await readFile(join(pkg, "runtime/components/Button/index.js"), "utf-8");
		expect(componentJs).toContain("react/jsx-runtime");
		// No root-level leakage: the runtime barrel is NOT at pkg root.
		expect(existsSync(join(pkg, "runtime.js"))).toBe(false);
	}, 120_000);
});
