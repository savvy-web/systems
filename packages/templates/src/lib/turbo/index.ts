import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

export const TurboRootOptions = Schema.Struct({
	tasks: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
	globalDependencies: Schema.optional(Schema.Array(Schema.String)),
	globalEnv: Schema.optional(Schema.Array(Schema.String)),
	globalPassThroughEnv: Schema.optional(Schema.Array(Schema.String)),
	ui: Schema.optional(Schema.Literal("tui", "stream")),
	concurrency: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
});

export type TurboRootOptionsType = typeof TurboRootOptions.Type;

export const TurboWorkspaceOptions = Schema.Struct({
	tasks: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

export type TurboWorkspaceOptionsType = typeof TurboWorkspaceOptions.Type;

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
