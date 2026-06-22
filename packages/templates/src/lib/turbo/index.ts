import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

/**
 * Options for generating a root `turbo.json` file.
 *
 * @public
 */
export const TurboRootOptions = Schema.Struct({
	tasks: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
	globalDependencies: Schema.optional(Schema.Array(Schema.String)),
	globalEnv: Schema.optional(Schema.Array(Schema.String)),
	globalPassThroughEnv: Schema.optional(Schema.Array(Schema.String)),
	ui: Schema.optional(Schema.Literal("tui", "stream")),
	concurrency: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
});

/**
 * The decoded type of {@link TurboRootOptions}.
 *
 * @public
 */
export type TurboRootOptionsType = typeof TurboRootOptions.Type;

/**
 * Options for generating a workspace-level `turbo.json` file.
 *
 * @public
 */
export const TurboWorkspaceOptions = Schema.Struct({
	tasks: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

/**
 * The decoded type of {@link TurboWorkspaceOptions}.
 *
 * @public
 */
export type TurboWorkspaceOptionsType = typeof TurboWorkspaceOptions.Type;

/**
 * Generates a root `turbo.json` file entry.
 *
 * @param options - the root Turborepo configuration options
 * @returns an array containing the generated root `turbo.json` entry
 * @public
 */
export function createTurboRoot(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(TurboRootOptions)(options);

	const config: Record<string, unknown> = {
		$schema: "https://turborepo.com/schema.v2.json",
		tasks: opts.tasks,
	};

	if (opts.globalDependencies && opts.globalDependencies.length > 0) {
		config.globalDependencies = opts.globalDependencies;
	}
	if (opts.globalEnv && opts.globalEnv.length > 0) {
		config.globalEnv = opts.globalEnv;
	}
	if (opts.globalPassThroughEnv && opts.globalPassThroughEnv.length > 0) {
		config.globalPassThroughEnv = opts.globalPassThroughEnv;
	}
	if (opts.ui) config.ui = opts.ui;
	if (opts.concurrency !== undefined) config.concurrency = opts.concurrency;

	const content = JSON.stringify(config, null, "\t");

	return [{ name: "turbo-root", filename: "turbo.json", content }];
}

/**
 * Generates a workspace-level `turbo.json` file entry.
 *
 * @param options - the workspace Turborepo configuration options
 * @returns an array containing the generated workspace `turbo.json` entry
 * @public
 */
export function createTurboWorkspace(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(TurboWorkspaceOptions)(options);

	const config: Record<string, unknown> = {
		extends: ["//"],
	};

	if (opts.tasks && Object.keys(opts.tasks).length > 0) {
		config.tasks = opts.tasks;
	}

	const content = JSON.stringify(config, null, "\t");

	return [{ name: "turbo-workspace", filename: "turbo.json", content }];
}
