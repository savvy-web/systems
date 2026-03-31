import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

const Settings = Schema.Struct({
	biome: Schema.optional(Schema.Boolean),
	turbo: Schema.optional(Schema.Boolean),
	vitest: Schema.optional(Schema.Boolean),
});

export const VsCodeOptions = Schema.Struct({
	settings: Schema.optional(Settings),
	extensions: Schema.optional(Schema.Array(Schema.String)),
});

export type VsCodeOptionsType = typeof VsCodeOptions.Type;

export function createVsCode(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(VsCodeOptions)(options);
	const features = opts.settings ?? {};

	const codeActions: Record<string, string> = {
		"source.fixAll.ts": "explicit",
	};

	const searchExclude: Record<string, boolean> = {
		"**/node_modules": true,
		"**/dist": true,
		"**/.rslib": true,
		"**/*.tsbuildinfo": true,
	};

	const filesExclude: Record<string, boolean> = {
		"**/node_modules": true,
		"**/dist": true,
		"**/.rslib": true,
		"**/*.tsbuildinfo": true,
	};

	if (features.biome) {
		codeActions["source.organizeImports.biome"] = "explicit";
		codeActions["source.fixAll.biome"] = "explicit";
	}

	if (features.vitest) {
		searchExclude["**/.vitest"] = true;
		searchExclude["**/.coverage"] = true;
		filesExclude["**/.vitest"] = true;
		filesExclude["**/.coverage"] = true;
	}

	if (features.turbo) {
		searchExclude["**/.turbo"] = true;
		filesExclude["**/.turbo"] = true;
	}

	const settings: Record<string, unknown> = {
		"editor.formatOnSave": true,
		"eslint.enable": !features.biome,
		"prettier.enable": !features.biome,
		"biome.enabled": !!features.biome,
		"biome.requireConfiguration": true,
		"editor.codeActionsOnSave": codeActions,
		"search.exclude": searchExclude,
		"files.exclude": filesExclude,
	};

	const recommendations = [...new Set(opts.extensions ?? [])].sort();

	return [
		{
			name: "vscode-settings",
			filename: ".vscode/settings.json",
			content: JSON.stringify(settings, null, "\t"),
		},
		{
			name: "vscode-extensions",
			filename: ".vscode/extensions.json",
			content: JSON.stringify({ recommendations }, null, "\t"),
		},
	];
}
