// packages/tsdown-plugins/src/report/schema.ts
import { Schema } from "effect";

export const ReportTimings = Schema.Struct({
	totalMs: Schema.Number,
}).annotations({ identifier: "ReportTimings" });

export const TargetGroupReport = Schema.Struct({
	id: Schema.String,
	entries: Schema.Array(Schema.String),
	emittedFiles: Schema.Array(Schema.String),
	timings: ReportTimings,
	warnings: Schema.Array(Schema.String),
	errors: Schema.Array(Schema.String),
}).annotations({ identifier: "TargetGroupReport" });

export const BuildReport = Schema.Struct({
	package: Schema.String,
	targetGroups: Schema.Array(TargetGroupReport),
}).annotations({ identifier: "BuildReport" });

export type BuildReport = typeof BuildReport.Type;
export type TargetGroupReport = typeof TargetGroupReport.Type;
