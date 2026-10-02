/**
 * `savvy clean`'s progress: the events a run publishes, the state they fold
 * into, and the documents drawn from it. Free of React, so the command
 * module and the tests import it without loading Ink.
 *
 * @internal
 */

import type { Block, Document } from "@effected/cli";
import { Doc, Status } from "@effected/cli";

/** A single removable artifact. */
export interface Target {
	readonly path: string;
	readonly kind: "dir" | "file";
}

/** A target that could not be removed, and why. */
export interface FailedTarget {
	readonly target: Target;
	readonly reason: string;
}

/** What a clean run publishes as it goes. */
export type CleanEvent =
	| { readonly _tag: "Started"; readonly workspaces: number; readonly dryRun: boolean }
	| { readonly _tag: "WorkspaceStarted"; readonly name: string }
	| {
			readonly _tag: "WorkspaceDone";
			readonly name: string;
			readonly removed: ReadonlyArray<Target>;
			readonly failed: ReadonlyArray<FailedTarget>;
	  }
	| { readonly _tag: "Ended" };

/** Where a clean run is. */
export interface CleanState {
	readonly phase: "idle" | "running" | "done";
	readonly dryRun: boolean;
	readonly workspaces: number;
	readonly finished: number;
	readonly current: string | undefined;
	readonly removed: number;
	readonly failed: ReadonlyArray<FailedTarget>;
}

/** The state before a run starts. */
export const initialCleanState: CleanState = {
	phase: "idle",
	dryRun: false,
	workspaces: 0,
	finished: 0,
	current: undefined,
	removed: 0,
	failed: [],
};

/** Fold one event into the state; a start begins afresh. */
export const reduceClean = (state: CleanState, event: CleanEvent): CleanState => {
	switch (event._tag) {
		case "Started":
			return { ...initialCleanState, phase: "running", dryRun: event.dryRun, workspaces: event.workspaces };
		case "WorkspaceStarted":
			return { ...state, current: event.name };
		case "WorkspaceDone":
			return {
				...state,
				finished: state.finished + 1,
				removed: state.removed + event.removed.length,
				failed: [...state.failed, ...event.failed],
			};
		case "Ended":
			return { ...state, phase: "done", current: undefined };
	}
};

/** `n removed, m failed` (or `would remove` on a dry run); a zero `failed` is left out. */
const counts = (state: CleanState): Block =>
	Doc.counts({
		layout: "inline",
		share: false,
		counters: [
			Doc.counter(Status.core, "success", {
				key: "removed",
				label: state.dryRun ? "would remove" : "removed",
				n: state.removed,
				showZero: true,
			}),
			Doc.counter(Status.core, "failure", { key: "failed", label: "failed", n: state.failed.length }),
		],
	});

/** The paths that could not be removed, as a table. */
const failures = (failed: ReadonlyArray<FailedTarget>): ReadonlyArray<Block> =>
	failed.length === 0
		? []
		: [
				Doc.table(
					[{ header: "could not remove" }, { header: "kind" }, { header: "reason" }],
					failed.map((f) => [Doc.file(f.target.path), f.target.kind, f.reason]),
				),
			];

/** While the run goes: which workspace, how many are done, and the counts so far. */
export const progressDoc = (state: CleanState, spinner: string): Document => [
	Doc.line([
		Doc.text(spinner, "accent"),
		` ${state.dryRun ? "Previewing" : "Cleaning"} ${state.current ?? ""} (${state.finished}/${state.workspaces} workspaces)`,
	]),
	counts(state),
];

/** The committed summary: the counts, then any failures as a table. */
export const summaryDoc = (state: CleanState): Document => [counts(state), ...failures(state.failed)];
