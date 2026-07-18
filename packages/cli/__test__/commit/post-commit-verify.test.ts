import { describe, expect, it } from "vitest";
import { buildPostCommitAdvice } from "../../src/commands/commit/hooks/post-commit-verify.js";

describe("buildPostCommitAdvice", () => {
	it("emits commitlint-fail line when commitlint output indicates failure", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: true,
			sigStatus: "G",
			autoSignEnabled: true,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toContain("commitlint --last");
	});

	it("emits unsigned advice when sigStatus N and autoSign on", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus: "N",
			autoSignEnabled: true,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toContain("--amend --no-edit -S");
	});

	it("does not emit signature advice when commit.gpgsign is off", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus: "N",
			autoSignEnabled: false,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toBeNull();
	});

	// git's %G? reports E for "signature cannot be checked (e.g. missing key)".
	// The commit IS signed; the verifying environment simply cannot reach the
	// keyring or gpg-agent to check it — which is the norm inside a hook
	// subprocess. Treating that as a signing DEFECT told users to amend a commit
	// that was correctly signed all along (git log %G? in an interactive shell
	// reports G for the very same commit). Failure to verify is not evidence of a
	// bad signature.
	it("stays silent when the signature merely cannot be verified (E)", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus: "E",
			autoSignEnabled: true,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toBeNull();
	});

	it.each([
		["B", "bad signature"],
		["R", "revoked key"],
		["X", "expired signature"],
		["Y", "expired key"],
	])("still reports a genuinely defective signature (%s: %s)", (sigStatus) => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus,
			autoSignEnabled: true,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toContain(`'${sigStatus}'`);
	});

	it.each([["G"], ["U"]])("stays silent for a good signature (%s)", (sigStatus) => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus,
			autoSignEnabled: true,
			branchTicketId: null,
			bodyHasClosing: false,
		});
		expect(out).toBeNull();
	});

	it("emits closes-missing advice when branch implies ticket but body has none", () => {
		const out = buildPostCommitAdvice({
			commitlintFailed: false,
			sigStatus: "G",
			autoSignEnabled: true,
			branchTicketId: 42,
			bodyHasClosing: false,
		});
		expect(out).toContain("Closes: #42");
	});

	it("returns null when all checks pass", () => {
		expect(
			buildPostCommitAdvice({
				commitlintFailed: false,
				sigStatus: "G",
				autoSignEnabled: true,
				branchTicketId: 42,
				bodyHasClosing: true,
			}),
		).toBeNull();
	});
});
