import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

/**
 * Options for generating a `README.md` file.
 *
 * @public
 */
export const ReadmeOptions = Schema.Struct({
	name: Schema.String,
	description: Schema.optional(Schema.String),
});

/**
 * The decoded type of {@link ReadmeOptions}.
 *
 * @public
 */
export type ReadmeOptionsType = typeof ReadmeOptions.Type;

/**
 * Generates a `README.md` file entry.
 *
 * @param options - the README configuration options
 * @returns an array containing the generated `README.md` entry
 * @public
 */
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
