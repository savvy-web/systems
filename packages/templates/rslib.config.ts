import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
	externals: ["effect"],
	apiModel: {
		localPaths: ["../mcp/lib/models/templates"],
		suppressWarnings: [{ messageId: "ae-forgotten-export" }],
	},
	transform({ pkg }) {
		delete pkg.devDependencies;
		delete pkg.publishConfig;
		delete pkg.packageManager;
		delete pkg.devEngines;
		delete pkg.scripts;
		return pkg;
	},
});
