import { Repos } from "@savvy-web/silk-effects";
import { Cause, Effect, Exit, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspaceRoot } from "workspaces-effect";

import { effectToZodSchema } from "../../src/schema/effect-to-zod.js";
import { ReposManageAsMarkdown, ReposManageResult, reposManage } from "../../src/tools/repos-manage.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed("/repo") }),
);

const ReposManagerTest = Layer.succeed(
	Repos.ReposManager,
	Repos.ReposManager.of({
		status: () => Effect.die("not stubbed"),
		sync: () =>
			Effect.succeed({
				initialized: ["foo"],
				sparseApplied: [],
				upToDate: ["bar"],
				clearedLocks: [],
			}),
		add: (_root, options) =>
			Effect.succeed({
				name: options.name ?? "foo",
				ref: options.ref,
				path: `.repos/${options.name ?? "foo"}`,
			}),
		pin: (_root, name, ref) =>
			Effect.succeed({
				name,
				ref,
				oldCommit: "abc111",
				newCommit: "def222",
				commitMessage: "chore(repos): pin `foo` to main; `rm -rf /`",
				staleNoteIds: ["n-aaaa", "n-bbbb"],
			}),
		note: (_root, name, op) =>
			Effect.succeed({
				name,
				op: op.op,
				id: op.op === "add" ? "n-1234" : op.id,
				noteCount: 1,
			}),
	}),
);

const run = <A, E>(eff: Effect.Effect<A, E, Repos.ReposManager | WorkspaceRoot>) =>
	Effect.runPromise(eff.pipe(Effect.provide(ReposManagerTest), Effect.provide(WorkspaceRootTest)));

const runExit = <A, E>(eff: Effect.Effect<A, E, Repos.ReposManager | WorkspaceRoot>) =>
	Effect.runPromiseExit(eff.pipe(Effect.provide(ReposManagerTest), Effect.provide(WorkspaceRootTest)));

describe("reposManage handler — action dispatch", () => {
	it("dispatches sync", async () => {
		const data = await run(reposManage({ action: "sync" }, "/repo"));
		expect(data.action).toBe("sync");
		if (data.action === "sync") {
			expect(data.result.initialized).toEqual(["foo"]);
		}
	});

	it("dispatches pin", async () => {
		const data = await run(reposManage({ action: "pin", name: "foo", ref: "v2" }, "/repo"));
		expect(data.action).toBe("pin");
		if (data.action === "pin") {
			expect(data.result.name).toBe("foo");
			expect(data.result.ref).toBe("v2");
		}
	});

	it("dispatches add", async () => {
		const data = await run(
			reposManage({ action: "add", url: "https://example.com/foo.git", ref: "main", purpose: "vendor lib" }, "/repo"),
		);
		expect(data.action).toBe("add");
		if (data.action === "add") {
			expect(data.result.ref).toBe("main");
		}
	});

	it("dispatches note", async () => {
		const data = await run(reposManage({ action: "note", name: "foo", op: "add", note: "hello" }, "/repo"));
		expect(data.action).toBe("note");
		if (data.action === "note") {
			expect(data.result.op).toBe("add");
			expect(data.result.id).toBe("n-1234");
		}
	});
});

describe("reposManage handler — request validation", () => {
	it("rejects pin without ref, naming the missing field", async () => {
		const exit = await runExit(reposManage({ action: "pin", name: "foo" }, "/repo"));
		expect(Exit.isFailure(exit)).toBe(true);
		const message = Cause.pretty(Exit.isFailure(exit) ? exit.cause : Cause.empty);
		expect(message).toContain("ref");
	});

	it("rejects note op=promote without into/id", async () => {
		const exit = await runExit(reposManage({ action: "note", name: "foo", op: "promote" }, "/repo"));
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("rejects note op=add without note text", async () => {
		const exit = await runExit(reposManage({ action: "note", name: "foo", op: "add" }, "/repo"));
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("rejects note op=remove without id", async () => {
		const exit = await runExit(reposManage({ action: "note", name: "foo", op: "remove" }, "/repo"));
		expect(Exit.isFailure(exit)).toBe(true);
	});
});

describe("reposManage handler — pin markdown transcript", () => {
	it("surfaces commitMessage and staleNoteIds prominently, escaping backtick injection", async () => {
		const data = await run(reposManage({ action: "pin", name: "foo", ref: "main" }, "/repo"));
		const md = Schema.decodeSync(ReposManageAsMarkdown)(data);
		// The transcript must have a dedicated commit-message section...
		expect(md.toLowerCase()).toContain("commit message");
		expect(md).toContain("chore(repos): pin");
		// ...but never the raw unescaped backtick-fenced command it carries.
		expect(md).not.toContain("chore(repos): pin `foo` to main; `rm -rf /`");
		// staleNoteIds must be surfaced as the review/commit cue.
		expect(md.toLowerCase()).toContain("stale");
		expect(md).toContain("n-aaaa");
		expect(md).toContain("n-bbbb");
	});
});

describe("repos_manage effect->zod bridge", () => {
	it("converts the result union and parses a sync payload", () => {
		const zodSchema = effectToZodSchema(ReposManageResult);
		const parsed = zodSchema.safeParse({
			action: "sync",
			result: { initialized: ["foo"], sparseApplied: [], upToDate: [], clearedLocks: [] },
		});
		expect(parsed.success).toBe(true);
	});

	it("converts the result union and parses a pin payload", () => {
		const zodSchema = effectToZodSchema(ReposManageResult);
		const parsed = zodSchema.safeParse({
			action: "pin",
			result: {
				name: "foo",
				ref: "main",
				oldCommit: "abc111",
				newCommit: "def222",
				commitMessage: "chore(repos): pin foo to main",
				staleNoteIds: [],
			},
		});
		expect(parsed.success).toBe(true);
	});
});
