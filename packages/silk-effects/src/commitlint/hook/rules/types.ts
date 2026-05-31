/**
 * Shared types for the rule pipeline.
 *
 * @internal
 */
import type { Effect } from "effect";

export type RuleSeverity = "deny" | "advise";

export interface RuleHit {
	ruleId: string;
	severity: RuleSeverity;
	message: string;
}

export interface Rule<Input, Ctx, E = never, R = never> {
	id: string;
	severity: RuleSeverity;
	check: (input: Input, ctx: Ctx) => Effect.Effect<RuleHit | null, E, R>;
}

export function partitionHits(hits: ReadonlyArray<RuleHit>): {
	deny: RuleHit[];
	advise: RuleHit[];
} {
	const deny: RuleHit[] = [];
	const advise: RuleHit[] = [];
	for (const hit of hits) {
		if (hit.severity === "deny") deny.push(hit);
		else advise.push(hit);
	}
	return { deny, advise };
}
