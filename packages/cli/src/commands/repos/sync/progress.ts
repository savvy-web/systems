/**
 * `savvy repos sync`'s progress: the events a run publishes, the state they
 * fold into, and the documents drawn from it. Free of React, so the command
 * module and the tests import it without loading Ink.
 *
 * @internal
 */

import type { Block, Document } from "@effected/cli-kit";
import { Doc, Status } from "@effected/cli-kit";
import type { Repos } from "@savvy-web/silk-effects";

/** What a sync run publishes: each `ReposManager.sync` step, then `Ended`. */
export type SyncEvent = Repos.ReposSyncStep | { readonly _tag: "Ended" };

/** Where a sync run is. */
export interface SyncState {
	readonly phase: "idle" | "running" | "done";
	/** How many repos the manifest names. */
	readonly total: number;
	/** How many have finished. */
	readonly finished: number;
	/** The repo being worked on, if any. */
	readonly current: string | undefined;
	/** How many finished repos needed work (anything but `upToDate`). */
	readonly changed: number;
}

/** The state before a run starts. */
export const initialSyncState: SyncState = {
	phase: "idle",
	total: 0,
	finished: 0,
	current: undefined,
	changed: 0,
};

/** Fold one event into the state; a start begins afresh. */
export const reduceSync = (state: SyncState, event: SyncEvent): SyncState => {
	switch (event._tag) {
		case "Started":
			return { ...initialSyncState, phase: "running", total: event.repos.length };
		case "RepoStarted":
			return { ...state, current: event.name };
		case "RepoSynced":
			return {
				...state,
				finished: state.finished + 1,
				changed: state.changed + (event.actions.some((action) => action !== "upToDate") ? 1 : 0),
			};
		case "Ended":
			return { ...state, phase: "done", current: undefined };
	}
};

/** `n synced, m changed`; a zero `changed` is left out. */
const counts = (state: SyncState): Block =>
	Doc.counts({
		layout: "inline",
		share: false,
		counters: [
			Doc.counter(Status.core, "success", { key: "synced", label: "synced", n: state.finished, showZero: true }),
			Doc.counter(Status.core, "warning", { key: "changed", label: "changed", n: state.changed }),
		],
	});

/** While the run goes: which repo, and how many are done. */
export const progressDoc = (state: SyncState, spinner: string): Document => [
	Doc.line([Doc.text(spinner, "accent"), ` Syncing ${state.current ?? ""} (${state.finished}/${state.total} repos)`]),
];

/** The committed summary: the counts. */
export const summaryDoc = (state: SyncState): Document => [counts(state)];
