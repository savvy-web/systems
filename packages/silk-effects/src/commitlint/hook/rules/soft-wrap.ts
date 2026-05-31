/**
 * soft-wrap rule — advises when a bullet point appears to have an
 * artificial mid-bullet line wrap.
 *
 * Heuristic: a bullet line shorter than 80 chars, immediately followed
 * by an indented continuation line (not a new bullet), suggests the
 * agent wrapped at ~80 chars unnecessarily.
 *
 * @internal
 */
import { Effect } from "effect";
import type { Rule } from "./types.js";

export interface SoftWrapInput {
	message: string;
}

const BULLET = /^([ \t]*)[-*]\s/;
const CONTINUATION = /^[ \t]+\S/;

export const softWrapRule: Rule<SoftWrapInput, never> = {
	id: "soft-wrap",
	severity: "advise",
	check: (input) =>
		Effect.sync(() => {
			const lines = input.message.split("\n");
			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i] ?? "";
				const next = lines[i + 1] ?? "";
				const m = line.match(BULLET);
				if (!m) continue;
				if (line.length >= 80) continue;
				if (CONTINUATION.test(next) && !BULLET.test(next)) {
					return {
						ruleId: "soft-wrap",
						severity: "advise" as const,
						message:
							"A bullet point appears to have an artificial soft-wrap (a short bullet followed by an indented continuation). The body line limit is 300 chars; one bullet should fit on one line. Reflow the bullet onto a single line.",
					};
				}
			}
			return null;
		}),
};
