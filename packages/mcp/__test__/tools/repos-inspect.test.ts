import { describe, expect, it, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, FileSystem, Layer, Path, Schema } from "effect";
import { systemError } from "effect/PlatformError";

import { effectToZodSchema } from "../../src/schema/effect-to-zod.js";
import { ReposInspectModeSchema } from "../../src/server.js";
import { ReposInspectAsMarkdown, ReposInspectResult, reposInspect } from "../../src/tools/repos-inspect.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed("/repo") }),
);

/**
 * Neither `Path.layer` nor a bare `FileSystem.layerNoop` needs a platform
 * package (per the house testing convention) — `Path.layer` does real
 * path-joining, and the default `readFileString` noop fails every read,
 * matching a workspace with no `.gitmodules` for the status/config/drift
 * tests below (which never reach the `gitmodules` branch but still need the
 * handler's declared `R` satisfied).
 */
const PathTest = Path.layer;
const FileSystemAbsentTest = FileSystem.layerNoop({
	readFileString: () => Effect.fail(systemError({ _tag: "NotFound", module: "FileSystem", method: "readFileString" })),
});

const ReposManagerTest = Layer.succeed(
	Repos.ReposManager,
	Repos.ReposManager.of({
		status: () =>
			Effect.succeed({
				repos: [
					{
						name: "foo",
						ref: "main",
						purpose: "vendor lib",
						present: true,
						commit: "abc123",
						stagedCommit: "abc123",
						dirty: false,
						staleNoteIds: [],
					},
				],
				clean: true,
			}),
		sync: () => Effect.die("not stubbed"),
		add: () => Effect.die("not stubbed"),
		pin: () => Effect.die("not stubbed"),
		note: () => Effect.die("not stubbed"),
		remove: () => Effect.die("not stubbed"),
		rename: () => Effect.die("not stubbed"),
		restore: () => Effect.die("not stubbed"),
	}),
);

const ReposConfigStoreTest = Layer.succeed(
	Repos.ReposConfigStore,
	Repos.ReposConfigStore.of({
		exists: () => Effect.succeed(true),
		read: () =>
			Effect.succeed({
				repos: {
					foo: {
						url: "https://example.com/foo.git",
						ref: "main",
						purpose: "vendor lib",
						notes: [{ id: "n1", date: "2026-01-01", ref: "main", note: "contains `injection` text" }],
					},
				},
			}),
		write: () => Effect.die("not stubbed"),
		update: () => Effect.die("not stubbed"),
	}),
);

const ReposDriftTest = Layer.succeed(
	Repos.ReposDrift,
	Repos.ReposDrift.of({
		check: () =>
			Effect.succeed({
				drifts: [
					{
						name: "foo",
						kind: "urlMismatch",
						detail:
							'manifest entry "foo" expects url "https://example.com/foo.git" but .gitmodules records "https://example.com/other.git"',
						manifestValue: "https://example.com/foo.git",
						observedValue: "https://example.com/other.git",
					},
				],
				clean: false,
			}),
	}),
);

const TestLayer = Layer.mergeAll(
	ReposManagerTest,
	ReposConfigStoreTest,
	ReposDriftTest,
	WorkspaceRootTest,
	PathTest,
	FileSystemAbsentTest,
);

layer(TestLayer)("reposInspect handler", (it) => {
	it.effect("projects status mode and renders markdown", () =>
		Effect.gen(function* () {
			const data = yield* reposInspect({ mode: "status" }, "/repo");
			expect(data.mode).toBe("status");
			const md = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
			expect(md).toContain("foo");
			expect(md).toContain("abc123");
		}),
	);

	it.effect("projects config mode and renders markdown", () =>
		Effect.gen(function* () {
			const data = yield* reposInspect({ mode: "config" }, "/repo");
			expect(data.mode).toBe("config");
			if (data.mode === "config") {
				expect(data.result.repos.foo.url).toBe("https://example.com/foo.git");
			}
			const md = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
			expect(md).toContain("repos config");
			expect(md).toContain("vendor lib");
		}),
	);

	it.effect("projects drift mode and renders the drift kind in markdown", () =>
		Effect.gen(function* () {
			const data = yield* reposInspect({ mode: "drift" }, "/repo");
			expect(data.mode).toBe("drift");
			if (data.mode === "drift") {
				expect(data.report.clean).toBe(false);
				expect(data.report.drifts).toHaveLength(1);
			}
			const md = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
			expect(md).toContain("repos drift");
			expect(md).toContain("foo");
			expect(md).toContain("urlMismatch");
		}),
	);

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeUnknownSync(ReposInspectAsMarkdown)("anything")).toThrow();
	});

	it("renders repo-derived note text as an inert code span via delimiter runs (prompt-injection hardening)", () => {
		const payload = "`## heading";
		const data = {
			mode: "config" as const,
			result: {
				repos: {
					foo: {
						url: "https://example.com/foo.git",
						ref: "main",
						purpose: "vendor lib",
						notes: [{ id: "n1", date: "2026-01-01", ref: "main", note: payload }],
					},
				},
			},
		};
		const md = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
		// The payload is wrapped in a backtick run strictly longer than any run
		// it contains (here: 1-backtick run inside, so a 2-backtick delimiter),
		// space-padded because the value starts with a backtick.
		expect(md).toContain("`` `## heading ``");
		// The payload stays inert: no line of the transcript starts with the
		// injected heading.
		for (const line of md.split("\n")) {
			expect(line.startsWith("## heading")).toBe(false);
		}
		// The delimiter run is longer than the longest embedded run.
		const noteLine = md.split("\n").find((line) => line.includes("## heading")) ?? "";
		const runs = noteLine.match(/`+/g) ?? [];
		const longest = Math.max(...runs.map((run) => run.length));
		const embedded = (payload.match(/`+/g) ?? []).map((run) => run.length);
		expect(longest).toBeGreaterThan(Math.max(...embedded));
	});
});

describe("reposInspect gitmodules mode", () => {
	const gitmodulesText = [
		'[submodule ".repos/foo"]',
		"\tpath = .repos/foo",
		"\turl = https://example.com/foo.git",
		"\tbranch = main",
		"\tshallow = true",
		'[submodule ".repos/bar"]',
		"\tpath = .repos/bar",
		"\turl = https://example.com/bar.git",
		"",
	].join("\n");

	/** Stubs `FileSystem` to answer `readFileString` with the given text, mirroring `drift.ts`'s ambient-service read. */
	const fileSystemWith = (text: string) => FileSystem.layerNoop({ readFileString: () => Effect.succeed(text) });

	it.effect("renders both entries of a two-entry .gitmodules file", () =>
		Effect.gen(function* () {
			const data = yield* reposInspect({ mode: "gitmodules" }, "/repo");
			expect(data.mode).toBe("gitmodules");
			if (data.mode !== "gitmodules") throw new Error("expected gitmodules mode");
			expect(data.entries).toHaveLength(2);
			expect(data.parseError).toBeUndefined();

			const md = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
			expect(md).toContain(".repos/foo");
			expect(md).toContain(".repos/bar");
		}).pipe(
			Effect.provide(
				Layer.mergeAll(ReposManagerTest, ReposConfigStoreTest, ReposDriftTest, WorkspaceRootTest, PathTest),
			),
			Effect.provide(fileSystemWith(gitmodulesText)),
		),
	);

	it.effect("reports no entries when .gitmodules is absent", () =>
		Effect.gen(function* () {
			const data = yield* reposInspect({ mode: "gitmodules" }, "/repo");
			expect(data.mode).toBe("gitmodules");
			if (data.mode !== "gitmodules") throw new Error("expected gitmodules mode");
			expect(data.entries).toHaveLength(0);
			expect(data.parseError).toBeUndefined();
		}).pipe(Effect.provide(TestLayer)),
	);

	it.effect("reports empty entries plus a populated parseError on malformed .gitmodules text", () =>
		Effect.gen(function* () {
			// Unterminated section header -- `Gitmodules.parseResult` fails typed,
			// mirroring the fixture `ReposDrift`'s own `gitmodulesUnparsable` test
			// uses (services__drift.test.ts).
			const data = yield* reposInspect({ mode: "gitmodules" }, "/repo");
			expect(data.mode).toBe("gitmodules");
			if (data.mode !== "gitmodules") throw new Error("expected gitmodules mode");
			expect(data.entries).toHaveLength(0);
			expect(data.parseError).toBeDefined();
		}).pipe(
			Effect.provide(
				Layer.mergeAll(ReposManagerTest, ReposConfigStoreTest, ReposDriftTest, WorkspaceRootTest, PathTest),
			),
			Effect.provide(fileSystemWith('[submodule ".repos/foo"')),
		),
	);

	it.effect("propagates a permission-denied read as a typed failure, never collapsing it to an empty report", () =>
		Effect.gen(function* () {
			// Only a NotFound-classified read failure means "absent" (the
			// sibling test above). A PermissionDenied failure is a real
			// problem and must surface on the typed error channel -- folding
			// it into the same empty-report shape as "nothing vendored yet"
			// would silently hide a real access problem from the caller.
			const error = yield* Effect.flip(reposInspect({ mode: "gitmodules" }, "/repo"));
			expect(error._tag).toBe("GitSubmoduleError");
		}).pipe(
			Effect.provide(
				Layer.mergeAll(ReposManagerTest, ReposConfigStoreTest, ReposDriftTest, WorkspaceRootTest, PathTest),
			),
			Effect.provide(
				FileSystem.layerNoop({
					readFileString: () =>
						Effect.fail(systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "readFileString" })),
				}),
			),
		),
	);
});

describe("repos_inspect effect->zod bridge", () => {
	it("converts the result union and parses a status payload", () => {
		const zodSchema = effectToZodSchema(ReposInspectResult);
		const parsed = zodSchema.safeParse({
			mode: "status",
			result: {
				repos: [
					{
						name: "foo",
						ref: "main",
						purpose: "vendor lib",
						present: true,
						commit: "abc123",
						stagedCommit: "abc123",
						dirty: false,
						staleNoteIds: [],
					},
				],
				clean: true,
			},
		});
		expect(parsed.success).toBe(true);
	});

	it("converts the result union and parses a config payload", () => {
		const zodSchema = effectToZodSchema(ReposInspectResult);
		const parsed = zodSchema.safeParse({
			mode: "config",
			result: {
				repos: {
					foo: { url: "https://example.com/foo.git", ref: "main", purpose: "vendor lib" },
				},
			},
		});
		expect(parsed.success).toBe(true);
	});

	it("accepts every wire mode, including the new drift and gitmodules modes", () => {
		for (const mode of ["status", "config", "drift", "gitmodules"]) {
			expect(ReposInspectModeSchema.safeParse(mode).success).toBe(true);
		}
	});

	it("rejects an unknown mode at the wire boundary", () => {
		const parsed = ReposInspectModeSchema.safeParse("bogus");
		expect(parsed.success).toBe(false);
	});
});
