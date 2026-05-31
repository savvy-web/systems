/**
 * `savvy commit hook pre-commit-message` — reads a PreToolUse envelope on
 * stdin and emits deny/advise/silent output for the bash hook.
 *
 * @internal
 */
import { resolve } from "node:path";
import { Command } from "@effect/cli";
import { Commitlint } from "@savvy-web/silk-effects";
import { Effect, Schema } from "effect";

export interface EvaluateCtx {
	branchInfo: Commitlint.BranchInfo;
	openIssues: ReadonlyArray<Commitlint.OpenIssue>;
	autoSignEnabled: boolean;
}

export async function evaluateMessage(command: string, ctx: EvaluateCtx): Promise<Commitlint.HookOutput> {
	const parsed = Commitlint.parseBashCommand(command);
	if (parsed.kind === "unknown") return Commitlint.preToolUseSilent();
	if (parsed.message === null) return Commitlint.preToolUseSilent();

	const hits: Commitlint.RuleHit[] = [];
	const collect = async (eff: Effect.Effect<Commitlint.RuleHit | null>) => {
		const h = await Effect.runPromise(eff);
		if (h) hits.push(h);
	};

	await collect(Commitlint.forbiddenContentRule.check({ message: parsed.message }, undefined as never));
	await collect(Commitlint.planLeakageRule.check({ message: parsed.message }, undefined as never));
	await collect(Commitlint.softWrapRule.check({ message: parsed.message }, undefined as never));
	await collect(Commitlint.verbosityRule.check({ message: parsed.message }, undefined as never));
	await collect(
		Commitlint.closesTrailerRule.check(
			{ message: parsed.message },
			{ branchInfo: ctx.branchInfo, openIssues: ctx.openIssues },
		),
	);
	await collect(
		Commitlint.signingFlagConflictRule.check({ flags: parsed.flags }, { autoSignEnabled: ctx.autoSignEnabled }),
	);

	const { deny, advise } = Commitlint.partitionHits(hits);
	if (deny.length > 0) {
		return Commitlint.preToolUseDeny(
			["The following rules denied this commit message:", ...deny.map((h) => `- ${h.message}`)].join("\n"),
		);
	}
	if (advise.length > 0) {
		return Commitlint.preToolUseAdvise(
			[
				"The commit message you are about to write has issues that should be addressed:",
				...advise.map((h) => `- ${h.message}`),
			].join("\n"),
		);
	}
	return Commitlint.preToolUseSilent();
}

export const preCommitMessageCommand = Command.make("pre-commit-message", {}, () =>
	Effect.gen(function* () {
		const stdin = yield* Effect.promise(readStdin);
		let envelope: Schema.Schema.Type<typeof Commitlint.PreToolUseEnvelope>;
		try {
			envelope = Schema.decodeUnknownSync(Commitlint.PreToolUseEnvelope)(JSON.parse(stdin));
		} catch {
			return;
		}

		const command = String((envelope.tool_input as { command?: unknown }).command ?? "");
		if (!command) return;

		const branchInfo = yield* Commitlint.readBranchInfo();
		const signing = yield* Commitlint.readSigningDiagnostic();
		const issuesPath = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), Commitlint.ISSUES_CACHE_RELATIVE_PATH);
		const issues = (yield* Commitlint.readOpenIssuesFromCache(issuesPath)) ?? [];

		const out = yield* Effect.promise(() =>
			evaluateMessage(command, { branchInfo, openIssues: issues, autoSignEnabled: signing.autoSignEnabled }),
		);
		if (out !== null) {
			yield* Effect.sync(() => process.stdout.write(`${JSON.stringify(out)}\n`));
		}
	}).pipe(Effect.provide(Commitlint.HookSilencer)),
).pipe(Command.withDescription("Validate a candidate git commit / gh pr command's message"));

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString("utf8");
}
