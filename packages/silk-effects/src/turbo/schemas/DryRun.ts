import { Schema } from "effect";

/** turbo's per-target cache descriptor in `--dry=json`. */
export const TurboCache = Schema.Struct({
	local: Schema.Boolean,
	remote: Schema.Boolean,
	status: Schema.Literal("HIT", "MISS"),
	timeSaved: Schema.Number,
}).annotations({ identifier: "TurboCache" });

/** turbo's environment-variable contribution block (per-task and global). */
export const TurboEnvVars = Schema.Struct({
	specified: Schema.Struct({
		env: Schema.Array(Schema.String),
		passThroughEnv: Schema.NullOr(Schema.Array(Schema.String)),
	}),
	configured: Schema.Array(Schema.String),
	inferred: Schema.Array(Schema.String),
	passthrough: Schema.NullOr(Schema.Array(Schema.String)),
}).annotations({ identifier: "TurboEnvVars" });

/** A single task entry from `turbo run <task> --dry=json`. */
export const TurboDryTask = Schema.Struct({
	taskId: Schema.String,
	task: Schema.String,
	package: Schema.String,
	directory: Schema.String,
	hash: Schema.String,
	inputs: Schema.Record({ key: Schema.String, value: Schema.String }),
	hashOfExternalDependencies: Schema.String,
	cache: TurboCache,
	dependencies: Schema.Array(Schema.String),
	dependents: Schema.Array(Schema.String),
	environmentVariables: TurboEnvVars,
}).annotations({ identifier: "TurboDryTask" });

/** The `globalCacheInputs` block — the components of the global hash. */
export const TurboGlobalCacheInputs = Schema.Struct({
	rootKey: Schema.String,
	files: Schema.Record({ key: Schema.String, value: Schema.String }),
	hashOfExternalDependencies: Schema.String,
	hashOfInternalDependencies: Schema.String,
	environmentVariables: TurboEnvVars,
}).annotations({ identifier: "TurboGlobalCacheInputs" });

/** The subset of `turbo run <task> --dry=json` the Turbo namespace reads. */
export const TurboDryRun = Schema.Struct({
	turboVersion: Schema.String,
	globalCacheInputs: TurboGlobalCacheInputs,
	tasks: Schema.Array(TurboDryTask),
}).annotations({ identifier: "TurboDryRun" });

export type TurboDryRunType = Schema.Schema.Type<typeof TurboDryRun>;
export type TurboDryTaskType = Schema.Schema.Type<typeof TurboDryTask>;
