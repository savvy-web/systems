import { beforeEach, describe, expect, it, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";

import { effectToZodSchema } from "../../src/schema/effect-to-zod.js";
import {
	ChangesetInspectAsMarkdown,
	ChangesetInspectResult,
	changesetInspect,
} from "../../src/tools/changeset-inspect.js";

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

	it.effect("projects branch mode and renders markdown", () =>
		Effect.gen(function* () {
			const data = yield* changesetInspect({ mode: "branch" }, "/repo");
			expect(data.mode).toBe("branch");
			const md = Schema.decodeUnknownSync(ChangesetInspectAsMarkdown)(data);
			expect(md).toContain("@scope/foo");
		}),
	);

	it.effect("projects config mode", () =>
		Effect.gen(function* () {
			const data = yield* changesetInspect({ mode: "config" }, "/repo");
			expect(data.mode).toBe("config");
			const md = Schema.decodeUnknownSync(ChangesetInspectAsMarkdown)(data);
			expect(md).toContain("changeset config");
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
			const md = Schema.decodeUnknownSync(ChangesetInspectAsMarkdown)(data);
			expect(md).toContain("packages/foo/x.ts");
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

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeUnknownSync(ChangesetInspectAsMarkdown)("anything")).toThrow();
	});

	it("surfaces an unmappedHint reason on unmapped files in branch and classify markdown (#290)", () => {
		const hint = 'versionFiles of "@savvy-web/silk" (glob "plugins/*/plugin.json")';
		const branch = {
			mode: "branch" as const,
			result: {
				baseBranch: "main",
				mergeBaseSha: "abc123",
				files: [
					{
						path: "plugins/silk/plugin.json",
						status: "deleted" as const,
						package: null,
						reason: { kind: "unmappedHint" as const, hint },
					},
				],
				packagesAffected: [],
				unmappedFiles: ["plugins/silk/plugin.json"],
			},
		};
		const branchMd = Schema.decodeUnknownSync(ChangesetInspectAsMarkdown)(branch);
		expect(branchMd).toContain("versionFiles of");

		const classify = {
			mode: "classify" as const,
			result: [{ path: "plugins/silk/plugin.json", package: null, reason: { kind: "unmappedHint" as const, hint } }],
		};
		const classifyMd = Schema.decodeUnknownSync(ChangesetInspectAsMarkdown)(classify);
		expect(classifyMd).toContain("versionFiles of");
	});

	it("escapes repo-derived values as inert code spans (prompt-injection hardening)", () => {
		const data = {
			mode: "branch" as const,
			result: {
				baseBranch: "main",
				mergeBaseSha: "abc123",
				files: [{ path: "evil`whoami`.ts", status: "modified" as const, package: null, reason: null }],
				packagesAffected: [],
				unmappedFiles: ["evil`whoami`.ts"],
			},
		};
		const md = Schema.decodeUnknownSync(ChangesetInspectAsMarkdown)(data);
		// The raw, unescaped backtick form must not survive into the transcript.
		expect(md).not.toContain("evil`whoami`.ts");
		// Backticks are escaped inside a code span.
		expect(md).toContain("evil\\`whoami\\`.ts");
	});
});

describe("changeset_inspect effect->zod bridge", () => {
	it("converts the result union and parses a branch payload", () => {
		const zodSchema = effectToZodSchema(ChangesetInspectResult);
		const parsed = zodSchema.safeParse({
			mode: "branch",
			result: { baseBranch: "main", mergeBaseSha: "x", files: [], packagesAffected: [], unmappedFiles: [] },
		});
		expect(parsed.success).toBe(true);
	});
});
