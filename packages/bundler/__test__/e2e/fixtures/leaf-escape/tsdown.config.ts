import { defineConfig } from "tsdown";
import { dtsPassDtsOptions, emitManifest, packageJsonEntries, writeResolvedTsconfig } from "@savvy-web/tsdown-plugins";

const cwd = import.meta.dirname;
const tsconfig = writeResolvedTsconfig({ cwd });
// Only the generator choice is borrowed: the escape hatch emits JS too, so not `emitDtsOnly`.
const { generator, tsgo } = dtsPassDtsOptions(tsconfig);

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
	// Declarations through tsdown-plugins' own TypeScript 7.1 (generator + moduleUrl), never whatever
	// `typescript` tsdown happens to peer-resolve here — an escape-hatch consumer does the same.
	dts: { tsconfig, generator, tsgo },
	define: { "process.env.__PACKAGE_VERSION__": JSON.stringify("1.2.3") },
	plugins: [
		emitManifest({
			targetGroup: { id: "npm", name: "@fixture/leaf-escape", isProd: true },
			sourceDir: cwd,
		}),
	],
});
