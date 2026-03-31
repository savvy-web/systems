import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

export const BiomeOptions = Schema.Struct({
	version: Schema.String,
	extends: Schema.optional(Schema.Array(Schema.String)),
	root: Schema.optional(Schema.Boolean),
});

export type BiomeOptionsType = typeof BiomeOptions.Type;

export function createBiome(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(BiomeOptions)(options);

	const config: Record<string, unknown> = {
		$schema: `https://biomejs.dev/schemas/${opts.version}/schema.json`,
	};

	if (opts.extends && opts.extends.length > 0) config.extends = opts.extends;
	if (opts.root !== undefined) config.root = opts.root;

	const content = JSON.stringify(config, null, "\t");

	return [{ name: "biome", filename: "biome.jsonc", content }];
}
