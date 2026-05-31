import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { signingFlagConflictRule } from "../../../../src/commitlint/hook/rules/signing-flag-conflict.js";

const ON = { autoSignEnabled: true };
const OFF = { autoSignEnabled: false };

describe("signingFlagConflictRule", () => {
	it("denies when --no-gpg-sign is used while commit.gpgsign=true", async () => {
		const hit = await Effect.runPromise(
			signingFlagConflictRule.check({ flags: { sign: "force-off", noVerify: false, amend: false } }, ON),
		);
		expect(hit?.severity).toBe("deny");
	});

	it("returns null when --no-gpg-sign is used and commit.gpgsign is false", async () => {
		const hit = await Effect.runPromise(
			signingFlagConflictRule.check({ flags: { sign: "force-off", noVerify: false, amend: false } }, OFF),
		);
		expect(hit).toBeNull();
	});

	it("returns null when sign is default", async () => {
		const hit = await Effect.runPromise(
			signingFlagConflictRule.check({ flags: { sign: "default", noVerify: false, amend: false } }, ON),
		);
		expect(hit).toBeNull();
	});
});
