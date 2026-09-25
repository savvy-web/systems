import { describe, expect, it, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Result, Schema } from "effect";

import { ReposManageResult, handleReposManage, reposManage } from "../../src/tools/repos-manage.js";

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

layer(TestLayer)("reposManage handler — pin review/commit cue", (it) => {
	it.effect("carries commitMessage verbatim and every staleNoteId in the pin result", () =>
		Effect.gen(function* () {
			const data = yield* reposManage({ action: "pin", name: "foo", ref: "main" }, "/repo");
			expect(data.action).toBe("pin");
			expect(data.action === "pin" ? data.result.commitMessage : undefined).toBe(
				"chore(repos): pin `foo` to main; `rm -rf /`",
			);
			expect(data.action === "pin" ? data.result.staleNoteIds : []).toEqual(["n-aaaa", "n-bbbb"]);
		}),
	);
});

describe("repos_manage served schema", () => {
	const accepts = (payload: unknown) => Result.isSuccess(Schema.decodeUnknownResult(ReposManageResult)(payload));

	it("the result union accepts a sync payload", () => {
		expect(
			accepts({
				action: "sync",
				result: {
					initialized: ["foo"],
					sparseApplied: [],
					upToDate: [],
					clearedLocks: [],
					urlSynced: [],
					registered: [],
					boundaryMarked: [],
				},
			}),
		).toBe(true);
	});

	it("the result union accepts a pin payload", () => {
		expect(
			accepts({
				action: "pin",
				result: {
					name: "foo",
					ref: "main",
					oldCommit: "abc111",
					newCommit: "def222",
					commitMessage: "chore(repos): pin foo to main",
					staleNoteIds: [],
				},
			}),
		).toBe(true);
	});

	it("the result union accepts a remove payload", () => {
		expect(
			accepts({
				action: "remove",
				result: {
					name: "foo",
					path: ".repos/foo",
					commitMessage: "chore(repos): remove foo",
					removedNotes: [{ id: "n-aaaa", date: "2026-01-01", ref: "1.0.0", note: "written against 1.0.0" }],
					removedEntry: { url: "https://example.com/foo.git", ref: "1.0.0", purpose: "vendor lib" },
				},
			}),
		).toBe(true);
	});

	it("the result union accepts a rename payload", () => {
		expect(
			accepts({
				action: "rename",
				result: {
					oldName: "foo",
					newName: "bar",
					path: ".repos/bar",
					commitMessage: "chore(repos): rename foo to bar",
				},
			}),
		).toBe(true);
	});

	it("the result union accepts a restore payload", () => {
		expect(
			accepts({
				action: "restore",
				result: {
					restored: [{ name: "foo", commit: "abc111" }],
					skippedClean: ["bar"],
					stillDirty: [],
				},
			}),
		).toBe(true);
	});

	it("the result union accepts a deregister payload", () => {
		expect(
			accepts({
				action: "deregister",
				result: {
					section: ".repos/old",
					removedKeys: ["submodule..repos/old.url"],
				},
			}),
		).toBe(true);
	});
});

describe("handleReposManage argument-decode failures", () => {
	it.effect("renders the decode failure as InvalidArgument with the echoed text bounded", () =>
		Effect.gen(function* () {
			// `pin` without `ref` fails the per-action decode; the decode message
			// echoes the offending value, so a 50k-character name must not reach
			// the wire whole.
			const name = "n".repeat(50_000);
			const error = yield* Effect.flip(handleReposManage("/repo", { action: "pin", name }));
			expect(error._tag).toBe("InvalidArgument");
			expect(error.message).toContain("repos_manage pin:");
			expect(error.message.length).toBeLessThan(2500);
			expect(error.message).toContain("Pass the fields the chosen action needs");
		}).pipe(Effect.provide(Layer.mergeAll(WorkspaceRootTest, ReposManagerTest))),
	);
});
