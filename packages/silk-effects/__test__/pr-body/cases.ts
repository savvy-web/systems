/**
 * The shared byte-parity case matrix for the PrBody extraction.
 *
 * Consumed by two runners that must stay in lockstep:
 *
 * 1. the fixture GENERATOR, which ran the ORIGINAL implementation
 *    (`silk-release-action/src/utils/pr-body.ts` at the commit named in
 *    `fixtures/pr-body/expected.json`) over these cases to produce the
 *    expected outputs, and
 * 2. `parity.test.ts`, which runs the extracted `PrBody` implementation over
 *    the same cases and asserts byte equality.
 *
 * Round-trip semantics (both runners implement this loop identically): for
 * each step,
 *
 *   managed = build({ ...step, summary: extractSummary(current), priorBody: current })
 *   current = upsert(current, managed)
 *
 * which is exactly how `update-release-branch.ts` drives the original.
 */

export interface ParityIssue {
	readonly number: number;
	readonly title: string;
	readonly state: string;
}

export interface ParityBuildOptions {
	readonly subject: string;
	readonly linkedIssues: ReadonlyArray<ParityIssue>;
	readonly signoff: string;
	readonly summary: string;
	readonly priorBody?: string;
}

export interface ParityBuildCase {
	readonly name: string;
	readonly options: ParityBuildOptions;
}

export interface ParityRoundTripStep {
	readonly subject: string;
	readonly linkedIssues: ReadonlyArray<ParityIssue>;
	readonly signoff: string;
}

export interface ParityRoundTripCase {
	readonly name: string;
	readonly initial: string;
	readonly steps: ReadonlyArray<ParityRoundTripStep>;
}

const SIGNOFF = "Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>";

const open = (number: number, title = "Some title"): ParityIssue => ({ number, title, state: "open" });
const closed = (number: number, title = "Done already"): ParityIssue => ({ number, title, state: "closed" });

export const buildCases: ReadonlyArray<ParityBuildCase> = [
	{
		name: "basic",
		options: { subject: "release: 2.0.0", linkedIssues: [open(168)], signoff: SIGNOFF, summary: "" },
	},
	{
		name: "no-issues",
		options: { subject: "release: 1.2.3", linkedIssues: [], signoff: SIGNOFF, summary: "" },
	},
	{
		name: "open-and-closed",
		options: { subject: "release: 2.0.0", linkedIssues: [open(10), closed(11)], signoff: SIGNOFF, summary: "" },
	},
	{
		// Pins the historical asymmetry: the squash trailer renders duplicates
		// as-given while the references region deduplicates.
		name: "duplicate-open",
		options: { subject: "release: 2.0.0", linkedIssues: [open(170), open(170)], signoff: SIGNOFF, summary: "" },
	},
	{
		name: "with-summary",
		options: {
			subject: "release: 2.0.0",
			linkedIssues: [open(170)],
			signoff: SIGNOFF,
			summary: "This release fixes the widget.",
		},
	},
	{
		name: "carry-through",
		options: {
			subject: "release: 2.0.0",
			linkedIssues: [open(10), closed(11)],
			signoff: SIGNOFF,
			summary: "",
			priorBody: [
				'<!-- silk-release:references:start owned="10,11" -->',
				"Closes #10",
				"Closes #11",
				"Closes #999",
				"Fixes: #601",
				"See also #500",
				"<!-- silk-release:references:end -->",
			].join("\n"),
		},
	},
	{
		name: "data-owned-lookalike",
		options: {
			subject: "release: 2.0.0",
			linkedIssues: [],
			signoff: SIGNOFF,
			summary: "",
			priorBody: [
				'<!-- silk-release:references:start data-owned="700" -->',
				"Closes #700",
				"<!-- silk-release:references:end -->",
			].join("\n"),
		},
	},
	{
		name: "all-keywords-carried",
		options: {
			subject: "release: 2.0.0",
			linkedIssues: [],
			signoff: SIGNOFF,
			summary: "",
			priorBody: [
				"<!-- silk-release:references:start -->",
				"Fixes: #601",
				"Closed #602",
				"resolve #603",
				"FIX #604",
				"<!-- silk-release:references:end -->",
			].join("\n"),
		},
	},
];

export const roundTripCases: ReadonlyArray<ParityRoundTripCase> = [
	{
		name: "seed-then-regenerate-above-human-note",
		initial: "Some notes I typed by hand.\n\nAnd a second paragraph.",
		steps: [
			{ subject: "release: 1.0.0", linkedIssues: [open(170)], signoff: SIGNOFF },
			{ subject: "release: 2.0.0", linkedIssues: [open(171)], signoff: SIGNOFF },
		],
	},
	{
		name: "empty-seed-replace-region",
		initial: "",
		steps: [
			{ subject: "release: 1.0.0", linkedIssues: [open(168)], signoff: SIGNOFF },
			{ subject: "release: 2.0.0", linkedIssues: [open(200)], signoff: SIGNOFF },
		],
	},
];
