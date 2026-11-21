/**
 * `savvy repos sync`'s live view — the only module that holds JSX, imported
 * by the command only on the path that draws (a person at a terminal), so the
 * session hook's piped run never loads React or Ink.
 *
 * @internal
 */

import type { LiveOptions } from "@effected/cli-kit/ui";
import { DocView, useGlyphs } from "@effected/cli-kit/ui";
import type { ReactElement } from "react";
import type { SyncEvent, SyncState } from "./progress.js";
import { initialSyncState, progressDoc, reduceSync, summaryDoc } from "./progress.js";

/** Draws the run: progress while it goes, the summary once it has ended. */
const SyncProgress = ({ state, frame }: { readonly state: SyncState; readonly frame: number }): ReactElement => {
	const glyphs = useGlyphs();
	if (state.phase === "done") return <DocView doc={summaryDoc(state)} />;
	const spinner = glyphs.spinner[frame % glyphs.spinner.length] ?? "";
	return <DocView doc={progressDoc(state, spinner)} />;
};

/** The view `savvy repos sync` mounts, minus its events; the tests drive this same value. */
export const syncView: Omit<LiveOptions<SyncEvent, SyncState>, "events"> = {
	initial: initialSyncState,
	reduce: reduceSync,
	render: (state, frame) => <SyncProgress state={state} frame={frame} />,
	isStart: (event) => event._tag === "Started",
	isTerminal: (event) => event._tag === "Ended",
};
