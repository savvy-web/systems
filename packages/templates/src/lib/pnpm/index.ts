import { Yaml } from "@effected/yaml";
import { Effect, Schema } from "effect";
import type { TemplateEntry } from "../types.js";

/**
 * Options for generating a `pnpm-workspace.yaml` file.
 *
 * @public
 */
export const PnpmWorkspaceOptions = Schema.Struct({
	packages: Schema.Array(Schema.String),
	autoInstallPeers: Schema.optional(Schema.Boolean),
	catalogMode: Schema.optional(Schema.Literals(["strict", "prefer", "manual"])),
	catalog: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

/**
 * The decoded type of {@link PnpmWorkspaceOptions}.
 *
 * @public
 */
export type PnpmWorkspaceOptionsType = typeof PnpmWorkspaceOptions.Type;

/**
 * Generates a `pnpm-workspace.yaml` file entry.
 *
 * @param options - the pnpm workspace configuration options
 * @returns an array containing the generated `pnpm-workspace.yaml` entry
 * @public
 */
export function createPnpmWorkspace(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(PnpmWorkspaceOptions)(options);

	const config: Record<string, unknown> = {
		packages: opts.packages,
	};

	if (opts.autoInstallPeers !== undefined) config.autoInstallPeers = opts.autoInstallPeers;
	if (opts.catalogMode) config.catalogMode = opts.catalogMode;
	if (opts.catalog && Object.keys(opts.catalog).length > 0) config.catalog = opts.catalog;

	const content = Effect.runSync(Yaml.stringify(config));

	return [{ name: "pnpm-workspace", filename: "pnpm-workspace.yaml", content }];
}
