/**
 * `savvy clean`'s live view — the only module that holds JSX, imported by
 * the command only on the path that draws (a person at a terminal), so no
 * other run loads React or Ink.
 *
 * @internal
 */

import type { LiveOptions } from "@effected/cli/ui";
import { DocView, useGlyphs } from "@effected/cli/ui";
import type { ReactElement } from "react";
import type { CleanEvent, CleanState } from "./progress.js";
import { initialCleanState, progressDoc, reduceClean, summaryDoc } from "./progress.js";

/** Draws the run: progress while it goes, the summary once it has ended. */
const CleanProgress = ({ state, frame }: { readonly state: CleanState; readonly frame: number }): ReactElement => {
	const glyphs = useGlyphs();
	if (state.phase === "done") return <DocView doc={summaryDoc(state)} />;
	const spinner = glyphs.spinner[frame % glyphs.spinner.length] ?? "";
	return <DocView doc={progressDoc(state, spinner)} />;
};

/** The view `savvy clean` mounts, minus its events; the tests drive this same value. */
export const cleanView: Omit<LiveOptions<CleanEvent, CleanState>, "events"> = {
	initial: initialCleanState,
	reduce: reduceClean,
	render: (state, frame) => <CleanProgress state={state} frame={frame} />,
	isStart: (event) => event._tag === "Started",
	isTerminal: (event) => event._tag === "Ended",
};
