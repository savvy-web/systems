import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
	externals: ["typescript", "source-map-support"],
	format: ["esm", "cjs"],
	cjsInterop: true,
	exportsAsIndexes: true,
	dtsBundledPackages: ["@commitlint/types"],
	copyPatterns: [{ from: "./**/*.jsonc", context: "./src/public" }],
	apiModel: {
		suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
		tsdoc: {
			tagDefinitions: [
				{
					tagName: "@since",
					syntaxKind: "modifier",
				},
			],
		},
	},
	transform({ pkg }) {
		// `@savvy-web/cli` and `@savvy-web/mcp` are declared as regular
		// `dependencies` in source so changesets versions them in lockstep with
		// silk: a peerDependency on a released workspace package forces a major
		// bump (1.0.0) on every minor of the dependency. Consumers should still
		// receive them as peers alongside the rest of the suite, so promote them
		// back into `peerDependencies` for the published manifest before the
		// `dependencies` block is stripped below.
		for (const name of ["@savvy-web/cli", "@savvy-web/mcp"]) {
			const range = pkg.dependencies?.[name];
			if (range) {
				pkg.peerDependencies ??= {};
				pkg.peerDependencies[name] = range;
			}
		}
		delete pkg.dependencies;
		delete pkg.devDependencies;
		delete pkg.bundleDependencies;
		delete pkg.scripts;
		delete pkg.publishConfig;
		delete pkg.devEngines;
		return pkg;
	},
});
