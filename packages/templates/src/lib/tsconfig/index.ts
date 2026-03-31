import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

export const TsConfigOptions = Schema.Struct({
	extends: Schema.optional(Schema.Union(Schema.String, Schema.Array(Schema.String))),
	composite: Schema.optional(Schema.Boolean),
	include: Schema.optional(Schema.Array(Schema.String)),
	exclude: Schema.optional(Schema.Array(Schema.String)),
	references: Schema.optional(Schema.Array(Schema.Struct({ path: Schema.String }))),
});

export type TsConfigOptionsType = typeof TsConfigOptions.Type;

export function createTsConfig(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(TsConfigOptions)(options);

	const config: Record<string, unknown> = {};

	if (opts.extends !== undefined) {
		config.extends = typeof opts.extends === "string" ? [opts.extends] : opts.extends;
	}
	if (opts.composite !== undefined) config.composite = opts.composite;
	if (opts.include) config.include = opts.include;
	if (opts.exclude) config.exclude = opts.exclude;
	if (opts.references) config.references = opts.references;

	const content = JSON.stringify(config, null, "\t");

	return [{ name: "tsconfig", filename: "tsconfig.json", content }];
}
