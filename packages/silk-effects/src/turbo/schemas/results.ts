import { Schema } from "effect";

/** Per-package cache outcome for one task. */
export const PackageCacheStatus = Schema.Struct({
	package: Schema.String,
	taskId: Schema.String,
	hash: Schema.String,
	status: Schema.Literals(["HIT", "MISS"]),
	timeSaved: Schema.Number,
}).annotate({ identifier: "PackageCacheStatus" });

/** The hash-contributor breakdown explaining a single MISS. */
export const MissExplanation = Schema.Struct({
	package: Schema.String,
	taskId: Schema.String,
	hash: Schema.String,
	inputFileCount: Schema.Number,
	hashedEnvVars: Schema.Array(Schema.String),
	externalDependenciesHash: Schema.String,
	dependsOn: Schema.Array(Schema.String),
}).annotate({ identifier: "MissExplanation" });

/** Global-hash component summary (every task inherits this). */
export const GlobalHashSummary = Schema.Struct({
	rootKey: Schema.String,
	globalFileCount: Schema.Number,
	externalDependenciesHash: Schema.String,
	internalDependenciesHash: Schema.String,
	globalEnvVars: Schema.Array(Schema.String),
}).annotate({ identifier: "GlobalHashSummary" });

/** Result of `TurboInspector.diagnoseCache`. */
export const CacheDiagnosis = Schema.Struct({
	task: Schema.String,
	totalTasks: Schema.Number,
	hits: Schema.Number,
	misses: Schema.Number,
	statuses: Schema.Array(PackageCacheStatus),
	explanations: Schema.Array(MissExplanation),
	global: GlobalHashSummary,
}).annotate({ identifier: "CacheDiagnosis" });

/** One node in the task graph. */
export const GraphNode = Schema.Struct({
	taskId: Schema.String,
	package: Schema.String,
	dependsOn: Schema.Array(Schema.String),
}).annotate({ identifier: "GraphNode" });

/** Result of `TurboInspector.taskGraph`. */
export const TaskGraphResult = Schema.Struct({
	task: Schema.optional(Schema.String),
	nodeCount: Schema.Number,
	nodes: Schema.Array(GraphNode),
	criticalPath: Schema.Array(Schema.String),
}).annotate({ identifier: "TaskGraphResult" });

/** Result of `TurboInspector.affected`. */
export const AffectedResult = Schema.Struct({
	base: Schema.String,
	packages: Schema.Array(Schema.String),
	dependents: Schema.Array(Schema.String),
}).annotate({ identifier: "AffectedResult" });

export type CacheDiagnosisType = Schema.Schema.Type<typeof CacheDiagnosis>;
export type TaskGraphResultType = Schema.Schema.Type<typeof TaskGraphResult>;
export type AffectedResultType = Schema.Schema.Type<typeof AffectedResult>;
