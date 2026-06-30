import { defineConfig } from "tsdown";
import { emitManifest, packageJsonEntries, writeResolvedTsconfig } from "@savvy-web/tsdown-plugins";

const cwd = import.meta.dirname;

// outDir uses a dedicated path so the escape-hatch test does not compete with
// build tests for the same dist/prod/npm/pkg directory.
export default defineConfig({
	cwd,
	entry: packageJsonEntries({ cwd }),
	outDir: `${cwd}/dist/escape/pkg`,
	format: ["esm"],
	platform: "node",
	unbundle: true,
	fixedExtension: false,
	// Unminified, mirroring the front door's default (Node libraries favor readable output).
	minify: false,
	dts: { tsconfig: writeResolvedTsconfig({ cwd }) },
	define: { "process.env.__PACKAGE_VERSION__": JSON.stringify("1.2.3") },
	plugins: [
		emitManifest({
			targetGroup: { id: "npm", name: "@fixture/leaf-escape", isProd: true },
			sourceDir: cwd,
		}),
	],
});
