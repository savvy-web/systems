import { describe, expect, it, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";

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

const TestLayer = Layer.mergeAll(ReposManagerTest, WorkspaceRootTest);

layer(TestLayer)("reposManage handler — action dispatch", (it) => {
	it.effect("dispatches sync", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "sync" }, "/repo");
			expect(data.action).toBe("sync");
			if (data.action === "sync") {
				expect(data.result.initialized).toEqual(["foo"]);
			}
		}),
	);

	it.effect("dispatches pin", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "pin", name: "foo", ref: "v2" }, "/repo");
			expect(data.action).toBe("pin");
			if (data.action === "pin") {
				expect(data.result.name).toBe("foo");
				expect(data.result.ref).toBe("v2");
			}
		}),
	);

	it.effect("dispatches add", () =>
		Effect.gen(function* () {
			const data = yield* reposManage(
				{ action: "add", url: "https://example.com/foo.git", ref: "main", purpose: "vendor lib" },
				"/repo",
			);
			expect(data.action).toBe("add");
			if (data.action === "add") {
				expect(data.result.ref).toBe("main");
			}
		}),
	);

	it.effect("dispatches note", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "note", name: "foo", op: "add", note: "hello" }, "/repo");
			expect(data.action).toBe("note");
			if (data.action === "note") {
				expect(data.result.op).toBe("add");
				expect(data.result.id).toBe("n-1234");
			}
		}),
	);
});

// `Effect.flip` (not `Effect.exit`) is the assertion here on purpose: it proves
// the rejection arrives through the TYPED error channel as a `SchemaError`. An
// `Exit.isFailure` check would also pass if the decode escaped as a defect.
layer(TestLayer)("reposManage handler — request validation", (it) => {
	it.effect("rejects pin without ref, naming the missing field", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(reposManage({ action: "pin", name: "foo" }, "/repo"));
			expect(error._tag).toBe("SchemaError");
			expect(error.message).toContain("ref");
		}),
	);

	it.effect("rejects note op=promote without into/id", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(reposManage({ action: "note", name: "foo", op: "promote" }, "/repo"));
			expect(error._tag).toBe("SchemaError");
		}),
	);

	it.effect("rejects note op=add without note text", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(reposManage({ action: "note", name: "foo", op: "add" }, "/repo"));
			expect(error._tag).toBe("SchemaError");
		}),
	);

	it.effect("rejects note op=remove without id", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(reposManage({ action: "note", name: "foo", op: "remove" }, "/repo"));
			expect(error._tag).toBe("SchemaError");
		}),
	);
});

layer(TestLayer)("reposManage handler — pin markdown transcript", (it) => {
	it.effect(
		"surfaces commitMessage and staleNoteIds prominently, neutralizing backtick injection via delimiter runs",
		() =>
			Effect.gen(function* () {
				const data = yield* reposManage({ action: "pin", name: "foo", ref: "main" }, "/repo");
				const md = Schema.decodeUnknownSync(ReposManageAsMarkdown)(data);
				// The transcript must have a dedicated commit-message section...
				expect(md.toLowerCase()).toContain("commit message");
				expect(md).toContain("chore(repos): pin");
				// ...with the backtick-carrying message wrapped in a delimiter run
				// strictly longer than any backtick run it contains (1-backtick runs
				// inside -> 2-backtick delimiter, space-padded for the trailing
				// backtick), so the embedded backticks cannot terminate the span.
				const commitLine = md.split("\n").find((line) => line.includes("rm -rf /")) ?? "";
				expect(commitLine).toBe("`` chore(repos): pin `foo` to main; `rm -rf /` ``");
				const runs = commitLine.match(/`+/g) ?? [];
				const longest = Math.max(...runs.map((run) => run.length));
				const embedded = ("chore(repos): pin `foo` to main; `rm -rf /`".match(/`+/g) ?? []).map((run) => run.length);
				expect(longest).toBeGreaterThan(Math.max(...embedded));
				// staleNoteIds must be surfaced as the review/commit cue.
				expect(md.toLowerCase()).toContain("stale");
				expect(md).toContain("n-aaaa");
				expect(md).toContain("n-bbbb");
			}),
	);

	it.effect("keeps a heading-injection note payload inert in the note transcript", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "note", name: "`## heading", op: "add", note: "x" }, "/repo");
			const md = Schema.decodeUnknownSync(ReposManageAsMarkdown)(data);
			// The payload renders inside a longer backtick run and never lands at
			// the start of a line as a live markdown heading.
			expect(md).toContain("`` `## heading ``");
			for (const line of md.split("\n")) {
				expect(line.startsWith("## heading")).toBe(false);
			}
		}),
	);
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
