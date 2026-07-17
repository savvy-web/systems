import { Schema } from "effect";

/**
 * Status values for `statusIcon`.
 * @public
 */
export const Status = Schema.Literals(["pass", "fail", "skip", "warn"]).annotate({
	identifier: "Status",
	title: "Check Status",
	description: "Status indicator for check run outcomes",
});

/** @public */
export type Status = typeof Status.Type;

/**
 * A single item in a checklist.
 * @public
 */
export const ChecklistItem = Schema.Struct({
	label: Schema.String,
	checked: Schema.Boolean,
}).annotate({
	identifier: "ChecklistItem",
	title: "Checklist Item",
});

/** @public */
export type ChecklistItem = typeof ChecklistItem.Type;

/**
 * A captured output entry.
 * @public
 */
export const CapturedOutput = Schema.Struct({
	name: Schema.String,
	value: Schema.String,
}).annotate({
	identifier: "CapturedOutput",
	title: "Captured Output",
});

/** @public */
export type CapturedOutput = typeof CapturedOutput.Type;
