/**
 * signing-flag-conflict rule — denies when the command explicitly opts out
 * of signing while the project is configured to require signing.
 *
 * @internal
 */
import { Effect } from "effect";
import type { ParsedCommit } from "../parse-bash-command.js";
import type { Rule } from "./types.js";

export interface SigningFlagInput {
	flags: ParsedCommit["flags"];
}

export interface SigningFlagCtx {
	autoSignEnabled: boolean;
}

export const signingFlagConflictRule: Rule<SigningFlagInput, SigningFlagCtx> = {
	id: "signing-flag-conflict",
	severity: "deny",
	check: (input, ctx) =>
		Effect.sync(() => {
			if (input.flags.sign !== "force-off") return null;
			if (!ctx.autoSignEnabled) return null;
			return {
				ruleId: "signing-flag-conflict",
				severity: "deny" as const,
				message:
					"Command uses --no-gpg-sign while commit.gpgsign=true is configured. Either remove --no-gpg-sign, or update git config commit.gpgsign first if you intend to leave signing off.",
			};
		}),
};
