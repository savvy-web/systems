// packages/tsdown-plugins/src/report/schema.ts
import { Schema } from "effect";

export class ReportTimings extends Schema.Class<ReportTimings>("ReportTimings")({
	totalMs: Schema.Number,
}) {}

/** A captured warning or error, from tsdown's logger, rolldown's onLog, or API Extractor. */
export class DiagnosticEntry extends Schema.Class<DiagnosticEntry>("DiagnosticEntry")({
	source: Schema.Literal("tsdown", "rolldown", "api-extractor"),
	level: Schema.Literal("warn", "error"),
	text: Schema.String,
	file: Schema.optional(Schema.String),
	line: Schema.optional(Schema.Number),
	column: Schema.optional(Schema.Number),
}) {}

/** One emitted output file with its in-memory byte size (gzip only when --verbose). */
export class EmittedFile extends Schema.Class<EmittedFile>("EmittedFile")({
	path: Schema.String,
	bytes: Schema.Number,
	gzip: Schema.optional(Schema.Number),
}) {}

/** One build pass within a target group (js / dts / loose / exe / meta). */
export class PassReport extends Schema.Class<PassReport>("PassReport")({
	id: Schema.Literal("js", "dts", "loose", "exe", "meta"),
	files: Schema.Array(EmittedFile),
	ms: Schema.Number,
}) {}

export class TargetGroupReport extends Schema.Class<TargetGroupReport>("TargetGroupReport")({
	id: Schema.String,
	entries: Schema.Array(Schema.String),
	passes: Schema.Array(PassReport),
	warnings: Schema.Array(DiagnosticEntry),
	errors: Schema.Array(DiagnosticEntry),
	timings: ReportTimings,
}) {}

export class BuildReport extends Schema.Class<BuildReport>("BuildReport")({
	package: Schema.String,
	targetGroups: Schema.Array(TargetGroupReport),
}) {}
