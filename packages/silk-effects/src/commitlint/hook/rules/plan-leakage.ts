/**
 * plan-leakage rule — advises when commit bodies reference plan files
 * or contain planning-narrative language.
 *
 * @internal
 */
import { Effect } from "effect";
import type { Rule } from "./types.js";

export interface PlanLeakageInput {
	message: string;
}

const PATH_PATTERNS = [/\.claude\/plans\//i, /\.claude\/design\//i];
const PHRASE_PATTERNS = [
	/\bas decided in the plan\b/i,
	/\bpreviously documented\b/i,
	/\bsee the design doc\b/i,
	/\bper the (plan|design doc|spec)\b/i,
];

export const planLeakageRule: Rule<PlanLeakageInput, never> = {
	id: "plan-leakage",
	severity: "advise",
	check: (input) =>
		Effect.sync(() => {
			const matchedPaths = PATH_PATTERNS.filter((re) => re.test(input.message));
			const matchedPhrases = PHRASE_PATTERNS.filter((re) => re.test(input.message));
			if (matchedPaths.length === 0 && matchedPhrases.length === 0) return null;

			const reasons: string[] = [];
			if (matchedPaths.length > 0) reasons.push("references planning artifacts (.claude/plans/ or .claude/design/)");
			if (matchedPhrases.length > 0) reasons.push("contains planning-narrative phrasing");

			return {
				ruleId: "plan-leakage",
				severity: "advise" as const,
				message: `Body ${reasons.join(" and ")}. Plan-file paths and "as decided in the plan"-style narrative belong in the PR description, not the commit body. Remove those references and re-run git commit.`,
			};
		}),
};
