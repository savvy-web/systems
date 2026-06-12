import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspaceRoot } from "workspaces-effect";

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
	}),
);

const run = <A, E>(eff: Effect.Effect<A, E, Changesets.BranchAnalyzer | Changesets.ConfigInspector | WorkspaceRoot>) =>
	Effect.runPromise(
		eff.pipe(
			Effect.provide(BranchAnalyzerTest),
			Effect.provide(ConfigInspectorTest),
			Effect.provide(WorkspaceRootTest),
		),
	);

describe("changesetInspect handler", () => {
	it("projects branch mode and renders markdown", async () => {
		const data = await run(changesetInspect({ mode: "branch" }, "/repo"));
		expect(data.mode).toBe("branch");
		const md = Schema.decodeSync(ChangesetInspectAsMarkdown)(data);
		expect(md).toContain("@scope/foo");
	});

	it("projects config mode", async () => {
		const data = await run(changesetInspect({ mode: "config" }, "/repo"));
		expect(data.mode).toBe("config");
		const md = Schema.decodeSync(ChangesetInspectAsMarkdown)(data);
		expect(md).toContain("changeset config");
	});

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeSync(ChangesetInspectAsMarkdown)("anything")).toThrow();
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
