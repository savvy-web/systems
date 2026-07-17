/**
 * `savvy commit hook session-start` — emits the additionalContext block
 * the SessionStart hook injects into the agent's context.
 *
 * @internal
 */
import { resolve } from "node:path";
import { Commitlint } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

export const sessionStartCommand = Command.make("session-start", {}, () =>
	Effect.gen(function* () {
		const branch = yield* Commitlint.readBranchInfo();
		const signing = yield* Commitlint.readSigningDiagnostic();
		const issuesCachePath = resolve(
			process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
			Commitlint.ISSUES_CACHE_RELATIVE_PATH,
		);
		const issues = yield* Commitlint.readOrFetchOpenIssues(issuesCachePath);

		const blocks: string[] = [];

		blocks.push(buildSkillDirectiveBlock());

		if (branch.branch) {
			blocks.push(buildBranchBlock(branch.branch, branch.inferredTicketId, issues));
		}

		blocks.push(buildSigningBlock(signing));

		const ctx = `<EXTREMELY_IMPORTANT>\n${blocks.join("\n\n")}\n</EXTREMELY_IMPORTANT>`;
		const out = Commitlint.sessionStartContext(ctx);
		yield* Effect.sync(() => process.stdout.write(`${JSON.stringify(out)}\n`));
	}).pipe(Effect.provide(Commitlint.HookSilencer)),
).pipe(Command.withDescription("Emit the SessionStart additionalContext for the commitlint plugin"));

function buildSkillDirectiveBlock(): string {
	return [
		"Before you run git commit, gh pr create, gh pr edit, amend a commit, or compose",
		"any commit message, you MUST invoke the commitlint:commit-create skill. It",
		"contains the complete type enum, tdd scope grammar, subject and body rules, DCO",
		"signoff format, Closes trailer pattern, and signing guidance.",
		"",
		"YOU DO NOT HAVE A CHOICE. Even if you believe the commit message is obvious,",
		"you MUST load the skill first. This is not negotiable. You cannot rationalize",
		"your way around it. The commit-msg hook will reject messages that violate the",
		"rules defined in that skill.",
	].join("\n");
}

function buildBranchBlock(
	branch: string,
	ticketId: number | null,
	issues: ReadonlyArray<{ number: number; title: string }> | null,
): string {
	const lines = [
		"<branch_context>",
		`<current_branch>${branch}</current_branch>`,
		`<inferred_ticket_id>${ticketId ?? "null"}</inferred_ticket_id>`,
	];
	if (issues && issues.length > 0) {
		lines.push("<open_issues_in_repo>");
		for (const i of issues) lines.push(`  - #${i.number}  ${i.title}`);
		lines.push("</open_issues_in_repo>");
	}
	lines.push("</branch_context>");
	return lines.join("\n");
}

function buildSigningBlock(d: {
	format: string;
	autoSignEnabled: boolean;
	signingKeyConfigured: boolean;
	keyResolves: boolean;
	agentResponsive: boolean;
	warnings: ReadonlyArray<string>;
}): string {
	const lines = [
		"<signing_diagnostic>",
		`<format>${d.format}</format>`,
		`<auto_sign_enabled>${d.autoSignEnabled}</auto_sign_enabled>`,
		`<signing_key_configured>${d.signingKeyConfigured}</signing_key_configured>`,
		`<key_resolves>${d.keyResolves}</key_resolves>`,
		`<agent_responsive>${d.agentResponsive}</agent_responsive>`,
		"<warnings>",
	];
	for (const w of d.warnings) lines.push(`  - ${w}`);
	lines.push("</warnings>", "</signing_diagnostic>");
	return lines.join("\n");
}
