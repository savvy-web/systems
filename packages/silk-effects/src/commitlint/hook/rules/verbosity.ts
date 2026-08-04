/**
 * verbosity rule — advises when the body exceeds line or word thresholds.
 *
 * @internal
 */
import { Effect } from "effect";
import type { Rule } from "./types.js";

export interface VerbosityInput {
	message: string;
}

/**
 * Body-line ceiling before the rule advises.
 *
 * @remarks
 * The house format is three to five bullets (or one to two short paragraphs)
 * plus a `Closes` line and a `Signed-off-by` line, and the counted body here
 * includes those two trailers. That is a 7-line message at the top of the
 * intended range, so 12 leaves headroom and fires only on a body that is
 * clearly past the format rather than at its boundary.
 */
export const VERBOSITY_LINE_THRESHOLD = 12;

/**
 * Body-word ceiling before the rule advises.
 *
 * @remarks
 * Five bullets at roughly 20 words each, plus trailers, lands near 110. A
 * two-paragraph prose body lands lower. 150 is the point past which a body
 * has stopped being a scannable index entry.
 */
export const VERBOSITY_WORD_THRESHOLD = 150;

export const verbosityRule: Rule<VerbosityInput, never> = {
	id: "verbosity",
	severity: "advise",
	check: (input) =>
		Effect.sync(() => {
			const all = input.message.split("\n");
			const body = all.slice(2).filter((l) => l.length > 0); // drop subject + blank line
			const lineCount = body.length;
			const wordCount = body.join(" ").trim().split(/\s+/).filter(Boolean).length;
			if (lineCount <= VERBOSITY_LINE_THRESHOLD && wordCount <= VERBOSITY_WORD_THRESHOLD) return null;
			const reasons: string[] = [];
			if (lineCount > VERBOSITY_LINE_THRESHOLD) reasons.push(`${lineCount} non-empty body lines`);
			if (wordCount > VERBOSITY_WORD_THRESHOLD) reasons.push(`${wordCount} words`);
			return {
				ruleId: "verbosity",
				severity: "advise" as const,
				message: `Body has ${reasons.join(" / ")}; the project standard is three to five bullets, or one to two short paragraphs, under ~${VERBOSITY_LINE_THRESHOLD} lines and ~${VERBOSITY_WORD_THRESHOLD} words. This repo squash-merges, so a long body is discarded at merge. Cut to the user-visible change, the behavior a consumer could trip over, and any non-obvious trap; move the reasoning and evidence to the PR description.`,
			};
		}),
};
