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
				urlSynced: [],
				registered: [],
				boundaryMarked: ["foo", "bar"],
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
		remove: (_root, name) =>
			Effect.succeed({
				name,
				path: `.repos/${name}`,
				commitMessage: `chore(repos): remove ${name}`,
				removedNotes: [{ id: "n-aaaa", date: "2026-01-01", ref: "1.0.0", note: "written against 1.0.0" }],
				removedEntry: {
					url: "https://example.test/foo.git",
					ref: "1.0.0",
					purpose: "fixture",
					notes: [{ id: "n-aaaa", date: "2026-01-01", ref: "1.0.0", note: "written against 1.0.0" }],
					orientation: { layout: "one package per dir", startHere: "src/index.ts" },
				},
			}),
		rename: (_root, oldName, newName) =>
			Effect.succeed({
				oldName,
				newName,
				path: `.repos/${newName}`,
				commitMessage: `chore(repos): rename ${oldName} to ${newName}`,
			}),
		restore: (_root, names) =>
			Effect.succeed({
				restored: (names ?? ["foo"]).map((name) => ({ name, commit: "abc111" })),
				skippedClean: names ? [] : ["bar"],
				stillDirty: [],
			}),
		deregister: (_root, section) =>
			Effect.succeed({
				section,
				removedKeys: [`submodule.${section}.url`, `submodule.${section}.active`],
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

	it.effect("dispatches remove", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "remove", name: "foo" }, "/repo");
			expect(data.action).toBe("remove");
			if (data.action === "remove") {
				expect(data.result.name).toBe("foo");
				expect(data.result.path).toBe(".repos/foo");
				expect(data.result.commitMessage).toBe("chore(repos): remove foo");
				expect(data.result.removedNotes).toHaveLength(1);
			}
		}),
	);

	it.effect("dispatches rename", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "rename", name: "foo", newName: "bar" }, "/repo");
			expect(data.action).toBe("rename");
			if (data.action === "rename") {
				expect(data.result.oldName).toBe("foo");
				expect(data.result.newName).toBe("bar");
				expect(data.result.path).toBe(".repos/bar");
				expect(data.result.commitMessage).toBe("chore(repos): rename foo to bar");
			}
		}),
	);

	it.effect("dispatches restore with explicit names", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "restore", names: ["foo", "quux"] }, "/repo");
			expect(data.action).toBe("restore");
			if (data.action === "restore") {
				expect(data.result.restored).toEqual([
					{ name: "foo", commit: "abc111" },
					{ name: "quux", commit: "abc111" },
				]);
				expect(data.result.skippedClean).toEqual([]);
			}
		}),
	);

	it.effect("dispatches restore with names omitted", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "restore" }, "/repo");
			expect(data.action).toBe("restore");
			if (data.action === "restore") {
				expect(data.result.restored).toEqual([{ name: "foo", commit: "abc111" }]);
				expect(data.result.skippedClean).toEqual(["bar"]);
			}
		}),
	);

	it.effect("dispatches deregister", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "deregister", section: ".repos/old" }, "/repo");
			expect(data.action).toBe("deregister");
			if (data.action === "deregister") {
				expect(data.result.section).toBe(".repos/old");
				expect(data.result.removedKeys).toEqual(["submodule..repos/old.url", "submodule..repos/old.active"]);
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

	it.effect("rejects remove without name", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(reposManage({ action: "remove" }, "/repo"));
			expect(error._tag).toBe("SchemaError");
			expect(error.message).toContain("name");
		}),
	);

	it.effect("rejects rename without newName", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(reposManage({ action: "rename", name: "foo" }, "/repo"));
			expect(error._tag).toBe("SchemaError");
			expect(error.message).toContain("newName");
		}),
	);

	it.effect("rejects deregister without section, naming the missing field", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(reposManage({ action: "deregister" }, "/repo"));
			expect(error._tag).toBe("SchemaError");
			expect(error.message).toContain("section");
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

	it.effect("surfaces commitMessage and removedNotes in the remove transcript as the review/commit cue", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "remove", name: "foo" }, "/repo");
			const md = Schema.decodeUnknownSync(ReposManageAsMarkdown)(data);
			expect(md.toLowerCase()).toContain("commit message");
			expect(md).toContain("chore(repos): remove foo");
			expect(md.toLowerCase()).toContain("removed notes");
			expect(md).toContain("n-aaaa");
			expect(md.toUpperCase()).toContain("REVIEW AND COMMIT");
		}),
	);

	it.effect("surfaces commitMessage in the rename transcript as the review/commit cue", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "rename", name: "foo", newName: "bar" }, "/repo");
			const md = Schema.decodeUnknownSync(ReposManageAsMarkdown)(data);
			expect(md.toLowerCase()).toContain("commit message");
			expect(md).toContain("chore(repos): rename foo to bar");
			expect(md.toUpperCase()).toContain("REVIEW AND COMMIT");
		}),
	);

	it.effect("names what was discarded in the restore transcript", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "restore", names: ["foo"] }, "/repo");
			const md = Schema.decodeUnknownSync(ReposManageAsMarkdown)(data);
			expect(md.toLowerCase()).toContain("restored");
			expect(md.toLowerCase()).toContain("discarded");
			expect(md).toContain("foo");
			expect(md).toContain("abc111");
		}),
	);

	it.effect("names the cleared keys and the nothing-to-commit posture in the deregister transcript", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "deregister", section: ".repos/old" }, "/repo");
			const md = Schema.decodeUnknownSync(ReposManageAsMarkdown)(data);
			expect(md).toContain("repos deregister");
			expect(md).toContain("submodule..repos/old.url");
			expect(md).toContain("submodule..repos/old.active");
			expect(md.toLowerCase()).toContain("nothing to commit");
		}),
	);

	it.effect("keeps a backtick-carrying section token inert in the deregister transcript", () =>
		Effect.gen(function* () {
			// The stub echoes the section back, so a hostile registration name
			// flows into both the heading and the removed-section line; the full
			// `submodule.<section>` token must render inside a longer backtick
			// run rather than terminating the span the line wraps it in.
			const data = yield* reposManage({ action: "deregister", section: "`## heading" }, "/repo");
			const md = Schema.decodeUnknownSync(ReposManageAsMarkdown)(data);
			// No space padding here, unlike the note-transcript case: the full
			// token starts with "submodule.", not a backtick, so mdInline only
			// lengthens the delimiter run.
			expect(md).toContain("``submodule.`## heading``");
			for (const line of md.split("\n")) {
				expect(line.startsWith("## heading")).toBe(false);
			}
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
			result: {
				initialized: ["foo"],
				sparseApplied: [],
				upToDate: [],
				clearedLocks: [],
				urlSynced: [],
				registered: [],
			},
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

	it("converts the result union and parses a remove payload", () => {
		const zodSchema = effectToZodSchema(ReposManageResult);
		const parsed = zodSchema.safeParse({
			action: "remove",
			result: {
				name: "foo",
				path: ".repos/foo",
				commitMessage: "chore(repos): remove foo",
				removedNotes: [{ id: "n-aaaa", date: "2026-01-01", ref: "1.0.0", note: "written against 1.0.0" }],
			},
		});
		expect(parsed.success).toBe(true);
	});

	it("converts the result union and parses a rename payload", () => {
		const zodSchema = effectToZodSchema(ReposManageResult);
		const parsed = zodSchema.safeParse({
			action: "rename",
			result: {
				oldName: "foo",
				newName: "bar",
				path: ".repos/bar",
				commitMessage: "chore(repos): rename foo to bar",
			},
		});
		expect(parsed.success).toBe(true);
	});

	it("converts the result union and parses a restore payload", () => {
		const zodSchema = effectToZodSchema(ReposManageResult);
		const parsed = zodSchema.safeParse({
			action: "restore",
			result: {
				restored: [{ name: "foo", commit: "abc111" }],
				skippedClean: ["bar"],
			},
		});
		expect(parsed.success).toBe(true);
	});

	it("converts the result union and parses a deregister payload", () => {
		const zodSchema = effectToZodSchema(ReposManageResult);
		const parsed = zodSchema.safeParse({
			action: "deregister",
			result: {
				section: ".repos/old",
				removedKeys: ["submodule..repos/old.url"],
			},
		});
		expect(parsed.success).toBe(true);
	});
});
