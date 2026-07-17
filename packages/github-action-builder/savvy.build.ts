import { build } from "@savvy-web/bundler";

await build({
	devManifest: "preserve",
	meta: {
		localPaths: ["../../website/lib/models/github-action-builder"],
		tsdoc: {
			suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
			tagDefinitions: [
				{ tagName: "@schema", syntaxKind: "modifier" },
				{ tagName: "@layer", syntaxKind: "modifier" },
				{ tagName: "@service", syntaxKind: "modifier" },
				{ tagName: "@error", syntaxKind: "modifier" },
			],
		},
	},
});
