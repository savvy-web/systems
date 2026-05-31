/**
 * forbidden-content rule — denies markdown headers and code fences in
 * commit message bodies.
 *
 * @internal
 */
import { Effect } from "effect";
import type { Rule } from "./types.js";

export interface ForbiddenContentInput {
	message: string;
}

export const forbiddenContentRule: Rule<ForbiddenContentInput, never> = {
	id: "forbidden-content",
	severity: "deny",
	check: (input) =>
		Effect.sync(() => {
			const lines = input.message.split("\n");
			for (const line of lines) {
				if (/^#{1,6}\s/.test(line)) {
					return {
						ruleId: "forbidden-content",
						severity: "deny" as const,
						message:
							"Body contains a markdown header (#, ##, ...). Headers are forbidden by the @savvy-web/commitlint Silk preset. Remove the header line and rewrite as plain prose or a bullet.",
					};
				}
				if (/^```/.test(line)) {
					return {
						ruleId: "forbidden-content",
						severity: "deny" as const,
						message:
							"Body contains a code fence (```). Code fences are forbidden in commit bodies. Move code samples to the PR description.",
					};
				}
			}
			return null;
		}),
};
