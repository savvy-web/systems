import { beforeEach, describe, expect, it, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Result, Schema } from "effect";

import { ChangesetInspectResult, changesetInspect } from "../../src/tools/changeset-inspect.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed("/repo") }),
);

const BranchAnalyzerTest = Layer.succeed(
	Changesets.BranchAnalyzer,
	Changesets.BranchAnalyzer.of({
		analyzeBranch: () =>
			Effect.succeed({
				baseBranch: "main",
				mergeBaseSha: "abc123",
				files: [{ path: "package/index.ts", status: "modified", package: "@scope/foo", reason: "workspace" }],
				packagesAffected: ["@scope/foo"],
				unmappedFiles: [],
			}),
	}),
);

let configInspectorRefreshCalls = 0;
let configInspectorRefreshInDirs: string[] = [];

const ConfigInspectorTest = Layer.succeed(
	Changesets.ConfigInspector,
	Changesets.ConfigInspector.of({
		inspect: () =>
			Effect.succeed({
				configPath: "/repo/.changeset/config.json",
				projectDir: "/repo",
				changelog: "@savvy-web/changesets/changelog",
				baseBranch: "main",
				access: "public" as const,
				ignore: [],
				packages: [],
				legacyVersionFilesUsed: false,
			}),
		classify: (_cwd, paths) => Effect.succeed(paths.map((p) => ({ path: p, package: null, reason: null }))),
		refresh: () =>
			Effect.sync(() => {
				configInspectorRefreshCalls++;
			}),
		refreshIn: (directory) =>
			Effect.sync(() => {
				configInspectorRefreshInDirs.push(directory);
			}),
	}),
);

const TestLayer = Layer.mergeAll(BranchAnalyzerTest, ConfigInspectorTest, WorkspaceRootTest);

layer(TestLayer)("changesetInspect handler", (it) => {
	// The suite-boundary layer is built ONCE for the group, so the stub's
	// call counter is cumulative across tests — reset it per test.
	beforeEach(() => {
		configInspectorRefreshCalls = 0;
		configInspectorRefreshInDirs = [];
	});

	it.effect("projects branch mode", () =>
		Effect.gen(function* () {
			const data = yield* changesetInspect({ mode: "branch" }, "/repo");
			expect(data.mode).toBe("branch");
			expect(data.mode === "branch" ? data.result.packagesAffected : []).toEqual(["@scope/foo"]);
		}),
	);

	it.effect("projects config mode", () =>
		Effect.gen(function* () {
			const data = yield* changesetInspect({ mode: "config" }, "/repo");
			expect(data.mode).toBe("config");
			expect(data.mode === "config" ? data.result.configPath : undefined).toBe("/repo/.changeset/config.json");
		}),
	);

	it.effect("projects classify mode for arbitrary paths", () =>
		Effect.gen(function* () {
			const data = yield* changesetInspect({ mode: "classify", paths: ["packages/foo/x.ts"] }, "/repo");
			expect(data.mode).toBe("classify");
			if (data.mode === "classify") {
				expect(data.result).toHaveLength(1);
				expect(data.result[0].path).toBe("packages/foo/x.ts");
			}
		}),
	);

	// #229: the long-lived savvy-mcp server holds one ConfigInspector for its
	// whole process lifetime; every call must refresh its cache first so an
	// on-disk edit made since the last tool call is observed. The refresh is
	// per-ROOT (refreshIn with the call's resolved root), so one call does
	// not discard sibling worktrees' still-valid caches — the wholesale
	// refresh() must NOT run here.
	it.effect("refreshes the ConfigInspector cache for the call's root before serving config mode", () =>
		Effect.gen(function* () {
			yield* changesetInspect({ mode: "config" }, "/repo");
			expect(configInspectorRefreshInDirs).toEqual(["/repo"]);
			expect(configInspectorRefreshCalls).toBe(0);
		}),
	);

	it.effect("refreshes the ConfigInspector cache for the call's root before serving classify mode", () =>
		Effect.gen(function* () {
			yield* changesetInspect({ mode: "classify", paths: [] }, "/repo");
			expect(configInspectorRefreshInDirs).toEqual(["/repo"]);
			expect(configInspectorRefreshCalls).toBe(0);
		}),
	);

	it.effect("refreshes the ConfigInspector cache for the call's root before serving branch mode", () =>
		Effect.gen(function* () {
			yield* changesetInspect({ mode: "branch" }, "/repo");
			expect(configInspectorRefreshInDirs).toEqual(["/repo"]);
			expect(configInspectorRefreshCalls).toBe(0);
		}),
	);
});

describe("changeset_inspect served schema", () => {
	it("the result union accepts a branch payload", () => {
		const parsed = Schema.decodeUnknownResult(ChangesetInspectResult)({
			mode: "branch",
			result: { baseBranch: "main", mergeBaseSha: "x", files: [], packagesAffected: [], unmappedFiles: [] },
		});
		expect(Result.isSuccess(parsed)).toBe(true);
	});
});
