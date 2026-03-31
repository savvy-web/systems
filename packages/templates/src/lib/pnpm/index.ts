import { Schema } from "effect";
import yaml from "js-yaml";
import type { TemplateEntry } from "../types.js";

export const PnpmWorkspaceOptions = Schema.Struct({
	packages: Schema.Array(Schema.String),
	autoInstallPeers: Schema.optional(Schema.Boolean),
	catalogMode: Schema.optional(Schema.Literal("strict", "prefer", "manual")),
	catalog: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
});

export type PnpmWorkspaceOptionsType = typeof PnpmWorkspaceOptions.Type;

export function createPnpmWorkspace(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(PnpmWorkspaceOptions)(options);

	const config: Record<string, unknown> = {
		packages: opts.packages,
	};

	if (opts.autoInstallPeers !== undefined) config.autoInstallPeers = opts.autoInstallPeers;
	if (opts.catalogMode) config.catalogMode = opts.catalogMode;
	if (opts.catalog && Object.keys(opts.catalog).length > 0) config.catalog = opts.catalog;

	const content = yaml.dump(config, {
		indent: 2,
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
	});

	return [{ name: "pnpm-workspace", filename: "pnpm-workspace.yaml", content }];
}
