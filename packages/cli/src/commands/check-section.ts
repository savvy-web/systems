/**
 * One tool's part of the `savvy check` report.
 *
 * @packageDocumentation
 */

import type { Block, InlineInput } from "@effected/cli";
import { Doc, Status } from "@effected/cli";

/**
 * A tool's verdict: `failure` when it found a misconfiguration (exit 1),
 * `warning` when it only has advice, `success` otherwise.
 */
export type CheckVerdict = "success" | "warning" | "failure";

/**
 * One tool's check, as blocks the caller places: `savvy check` folds each into
 * a collapsible (a `::group::` under GitHub Actions); a standalone run prints
 * the title as a heading over the blocks.
 *
 * @internal
 */
export interface CheckSection {
	/** The section title, e.g. `commitlint`. */
	readonly title: string;
	/** The section body. */
	readonly blocks: ReadonlyArray<Block>;
	/** The tool's verdict. */
	readonly verdict: CheckVerdict;
	/** Whether `savvy init` is the remediation for what was found. */
	readonly fixedByInit: boolean;
}

/** A managed hook section's state. */
export type SectionState = "up-to-date" | "outdated" | "missing" | "not installed";

/**
 * A status cell for a hook table: the glyph and the state, e.g. `✓ up-to-date`.
 * `not installed` is advisory (`↷`); `outdated`/`missing` are findings (`✗`).
 *
 * @internal
 */
export const stateCell = (state: SectionState): InlineInput => {
	const status = state === "up-to-date" ? "success" : state === "not installed" ? "skip" : "failure";
	return [Doc.status(Status.core, status), " ", state];
};

/**
 * The hook-section table: one row per `[hook, section, state]`.
 *
 * @internal
 */
export const hookTable = (rows: ReadonlyArray<readonly [string, string, SectionState]>): Block =>
	Doc.table(
		[{ header: "hook" }, { header: "section" }, { header: "state" }],
		rows.map(([hook, section, state]) => [hook, section, stateCell(state)]),
	);
