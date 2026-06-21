// packages/tsdown-plugins/src/report/schema.ts
import { Schema } from "effect";

export const ReportTimings = Schema.Struct({
	totalMs: Schema.Number,
}).annotations({ identifier: "ReportTimings" });

/** A captured warning or error, from tsdown's logger, rolldown's onLog, or API Extractor. */
export const DiagnosticEntry = Schema.Struct({
	source: Schema.Literal("tsdown", "rolldown", "api-extractor"),
	level: Schema.Literal("warn", "error"),
	text: Schema.String,
	file: Schema.optional(Schema.String),
	line: Schema.optional(Schema.Number),
	column: Schema.optional(Schema.Number),
}).annotations({ identifier: "DiagnosticEntry" });

/** One emitted output file with its in-memory byte size (gzip only when --verbose). */
export const EmittedFile = Schema.Struct({
	path: Schema.String,
	bytes: Schema.Number,
	gzip: Schema.optional(Schema.Number),
}).annotations({ identifier: "EmittedFile" });

/** One build pass within a target group (js / dts / loose / exe / meta). */
export const PassReport = Schema.Struct({
	id: Schema.Literal("js", "dts", "loose", "exe", "meta"),
	files: Schema.Array(EmittedFile),
	ms: Schema.Number,
}).annotations({ identifier: "PassReport" });

export const TargetGroupReport = Schema.Struct({
	id: Schema.String,
	entries: Schema.Array(Schema.String),
	passes: Schema.Array(PassReport),
	warnings: Schema.Array(DiagnosticEntry),
	errors: Schema.Array(DiagnosticEntry),
	timings: ReportTimings,
}).annotations({ identifier: "TargetGroupReport" });

export const BuildReport = Schema.Struct({
	package: Schema.String,
	targetGroups: Schema.Array(TargetGroupReport),
}).annotations({ identifier: "BuildReport" });

export type DiagnosticEntry = typeof DiagnosticEntry.Type;
export type EmittedFile = typeof EmittedFile.Type;
export type PassReport = typeof PassReport.Type;
export type BuildReport = typeof BuildReport.Type;
export type TargetGroupReport = typeof TargetGroupReport.Type;
