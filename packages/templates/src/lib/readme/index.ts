import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

export const ReadmeOptions = Schema.Struct({
	name: Schema.String,
	description: Schema.optional(Schema.String),
});

export type ReadmeOptionsType = typeof ReadmeOptions.Type;

export function createReadme(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(ReadmeOptions)(options);

	const lines = [`# ${opts.name}`];
	if (opts.description) {
		lines.push("", opts.description);
	}
	lines.push("");

	const content = lines.join("\n");

	return [{ name: "readme", filename: "README.md", content }];
}
