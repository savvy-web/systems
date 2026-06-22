import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

/**
 * Options for generating a `.gitignore` file.
 *
 * @public
 */
export const GitignoreOptions = Schema.Struct({
	sections: Schema.optional(
		Schema.Struct({
			node: Schema.optional(Schema.Boolean),
			build: Schema.optional(Schema.Boolean),
			env: Schema.optional(Schema.Boolean),
			os: Schema.optional(Schema.Boolean),
			silk: Schema.optional(Schema.Boolean),
		}),
	),
	additional: Schema.optional(Schema.Array(Schema.String)),
});

/**
 * The decoded type of {@link GitignoreOptions}.
 *
 * @public
 */
export type GitignoreOptionsType = typeof GitignoreOptions.Type;

/**
 * Generates a `.gitignore` file entry.
 *
 * @param options - the gitignore configuration options
 * @returns an array containing the generated `.gitignore` entry
 * @public
 */
export function createGitignore(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(GitignoreOptions)(options);
	const sections = {
		node: opts.sections?.node ?? true,
		build: opts.sections?.build ?? true,
		env: opts.sections?.env ?? true,
		os: opts.sections?.os ?? true,
		silk: opts.sections?.silk ?? true,
	};

	const lines: string[] = [];

	if (sections.os) {
		lines.push("# OS files", "**/.DS_Store", "");
	}

	if (sections.node) {
		lines.push("# Node.js", "**/node_modules", "**/*.tsbuildinfo*", "");
	}

	if (sections.build) {
		lines.push(
			"# Build artifacts",
			"**/dist",
			"**/.rslib",
			"**/.turbo",
			"**/*.api.json",
			"",
			"# Test artifacts",
			"**/.coverage",
			"**/.vitest",
			"",
		);
	}

	if (sections.silk) {
		lines.push(
			"# Release artifacts",
			"pnpm-publish-summary.json",
			"pnpm-release.json",
			".changeset/status.json",
			"",
			"# Private keys",
			"**/*.asc",
			"",
			"# AI agent settings",
			".mcp.json",
			"",
		);
	}

	if (sections.env) {
		lines.push("# Environment files", "**/.env", "**/.env.*", "");
	}

	if (opts.additional && opts.additional.length > 0) {
		lines.push("# Additional", ...opts.additional, "");
	}

	const content = lines.join("\n");

	return [{ name: "gitignore", filename: ".gitignore", content }];
}
