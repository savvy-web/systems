import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { signingFlagConflictRule } from "../../../../src/commitlint/hook/rules/signing-flag-conflict.js";

const ON = { autoSignEnabled: true };
const OFF = { autoSignEnabled: false };

describe("signingFlagConflictRule", () => {
	it.effect("denies when --no-gpg-sign is used while commit.gpgsign=true", () =>
		Effect.gen(function* () {
			const hit = yield* signingFlagConflictRule.check(
				{ flags: { sign: "force-off", noVerify: false, amend: false } },
				ON,
			);
			expect(hit?.severity).toBe("deny");
		}),
	);

	it.effect("returns null when --no-gpg-sign is used and commit.gpgsign is false", () =>
		Effect.gen(function* () {
			const hit = yield* signingFlagConflictRule.check(
				{ flags: { sign: "force-off", noVerify: false, amend: false } },
				OFF,
			);
			expect(hit).toBeNull();
		}),
	);

	it.effect("returns null when sign is default", () =>
		Effect.gen(function* () {
			const hit = yield* signingFlagConflictRule.check(
				{ flags: { sign: "default", noVerify: false, amend: false } },
				ON,
			);
			expect(hit).toBeNull();
		}),
	);
});
