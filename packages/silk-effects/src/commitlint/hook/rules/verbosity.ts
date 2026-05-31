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

export const VERBOSITY_LINE_THRESHOLD = 25;
export const VERBOSITY_WORD_THRESHOLD = 400;

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
				message: `Body has ${reasons.join(" / ")}; the project standard keeps commit bodies under ~${VERBOSITY_LINE_THRESHOLD} lines and ~${VERBOSITY_WORD_THRESHOLD} words. Move detail to the PR description and keep the commit body to the irreducible "what + why".`,
			};
		}),
};
