/**
 * Tests for {@link BranchAnalyzer}.
 *
 * Each test sets up a real git repo under `os.tmpdir()` — git is initialized,
 * an initial commit creates the project scaffolding (including
 * `.changeset/config.json` and the workspace layout consumed by
 * `ConfigInspector`), and a feature branch then commits the changes that
 * the analyzer should report on.
 *
 * Real git is required so the analyzer's `merge-base` + `diff --name-status`
 * calls behave exactly as they would in production. A pure mock layer for
 * `ConfigInspector` is composed in via `makeConfigInspectorTest` so the
 * inspector's filesystem dependencies don't need to be re-established
 * inside the git fixture.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { ConfigurationError, GitError } from "../../src/changesets/errors.js";
import type { BranchAnalysis } from "../../src/changesets/services/branch-analyzer.js";
import { BranchAnalyzer } from "../../src/changesets/services/branch-analyzer.js";
import type { InspectedConfig } from "../../src/changesets/services/config-inspector.js";
import { makeConfigInspectorTest } from "../../src/changesets/services/config-inspector.js";

interface GitFixtureOptions {
	readonly inspectedFor: (projectDir: string) => InspectedConfig;
	/** Files to create on the base branch before the initial commit. */
	readonly baseFiles?: ReadonlyArray<{ readonly path: string; readonly content: string }>;
	/**
	 * Mutations to apply on the feature branch after the initial commit.
	 * Each mutation runs sequentially; the final state is committed once.
	 */
	readonly featureChanges?: ReadonlyArray<
		| { readonly kind: "add"; readonly path: string; readonly content: string }
		| { readonly kind: "modify"; readonly path: string; readonly content: string }
		| { readonly kind: "delete"; readonly path: string }
		| { readonly kind: "rename"; readonly from: string; readonly to: string }
	>;
	/** Name of the feature branch to create. Defaults to `feature/test`. */
	readonly featureBranch?: string;
	/** Override the base branch name. Defaults to `main`. */
	readonly baseBranch?: string;
}

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "t@example.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "t@example.com",
		},
	});
}

function setupGitFixture(opts: GitFixtureOptions): { dir: string; layer: Layer.Layer<BranchAnalyzer> } {
	const dir = mkdtempSync(join(tmpdir(), "branch-analyzer-"));
	const baseBranch = opts.baseBranch ?? "main";
	const featureBranch = opts.featureBranch ?? "feature/test";

	git(dir, "init", "--quiet", "-b", baseBranch);
	git(dir, "config", "commit.gpgsign", "false");

	// Base files. Always seed at least one file so the initial commit has
	// content — empty commits would require `--allow-empty` and would alter
	// merge-base semantics in ways unrelated to what we're testing.
	const baseFiles = opts.baseFiles ?? [];
	if (baseFiles.length === 0) {
		writeFileSync(join(dir, ".gitkeep"), "");
	}
	for (const f of baseFiles) {
		mkdirSync(join(dir, f.path, ".."), { recursive: true });
		writeFileSync(join(dir, f.path), f.content);
	}
	git(dir, "add", "-A");
	git(dir, "commit", "--quiet", "-m", "base commit");

	// Create the feature branch
	git(dir, "checkout", "--quiet", "-b", featureBranch);

	// Apply feature changes
	for (const change of opts.featureChanges ?? []) {
		if (change.kind === "add" || change.kind === "modify") {
			mkdirSync(join(dir, change.path, ".."), { recursive: true });
			writeFileSync(join(dir, change.path), change.content);
		} else if (change.kind === "delete") {
			unlinkSync(join(dir, change.path));
		} else if (change.kind === "rename") {
			git(dir, "mv", change.from, change.to);
		}
	}
	if ((opts.featureChanges ?? []).length > 0) {
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "feature changes");
	}

	const inspected = opts.inspectedFor(dir);
	const inspectorLayer = makeConfigInspectorTest(inspected);
	// v4: BranchAnalyzer.layer composes @effected/git internally, which needs a
	// ChildProcessSpawner — NodeServices.layer supplies it.
	const layer = BranchAnalyzer.layer.pipe(Layer.provide(inspectorLayer), Layer.provide(NodeServices.layer));

	return { dir, layer };
}

function inspectedConfig(projectDir: string, overrides?: Partial<InspectedConfig>): InspectedConfig {
	return {
		configPath: join(projectDir, ".changeset", "config.json"),
		projectDir,
		changelog: "@savvy-web/changesets/changelog",
		baseBranch: "main",
		access: "restricted",
		ignore: [],
		packages: [],
		legacyVersionFilesUsed: false,
		...overrides,
	};
}

// Per-test provide is REQUIRED in both helpers, not an unoptimised leftover: `layer` is a
// parameter built by `setupGitFixture` around a per-test throwaway git repo, so it genuinely
// varies test by test and cannot be hoisted into a suite-boundary `layer(...)` block.
const runAnalyze = (layer: Layer.Layer<BranchAnalyzer>, cwd: string, opts?: { readonly baseBranch?: string }) =>
	Effect.gen(function* () {
		const analyzer = yield* BranchAnalyzer;
		return yield* analyzer.analyzeBranch(cwd, opts);
	}).pipe(Effect.provide(layer));

const runAnalyzeFail = (layer: Layer.Layer<BranchAnalyzer>, cwd: string, opts?: { readonly baseBranch?: string }) =>
	Effect.gen(function* () {
		const analyzer = yield* BranchAnalyzer;
		return yield* analyzer.analyzeBranch(cwd, opts);
	}).pipe(Effect.provide(layer), Effect.flip);

describe("BranchAnalyzer.analyzeBranch", () => {
	const trash: string[] = [];

	beforeEach(() => {
		// no-op; per-test fixtures are created via setupGitFixture
	});

	afterEach(() => {
		while (trash.length > 0) {
			const d = trash.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	it.effect("returns an empty analysis for a branch with no diff against base", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [{ path: "README.md", content: "base" }],
				featureChanges: [],
			});
			trash.push(dir);

			const result = yield* runAnalyze(layer, dir);
			expect(result.baseBranch).toBe("main");
			expect(result.files).toEqual([]);
			expect(result.packagesAffected).toEqual([]);
			expect(result.unmappedFiles).toEqual([]);
			expect(result.mergeBaseSha.length).toBeGreaterThan(0);
		}),
	);

	it.effect("reports added, modified, and deleted files with status", () =>
		Effect.gen(function* () {
			// Use unique content per file so git's rename-detection heuristic does
			// not collapse an unrelated add/delete pair into a "renamed" entry.
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [
					{ path: "keep.md", content: "unique-keep-content-12345" },
					{ path: "modify.md", content: "unique-modify-v1-67890" },
					{ path: "delete.md", content: "unique-delete-content-abcde" },
				],
				featureChanges: [
					{ kind: "add", path: "new.md", content: "unique-added-content-fghij" },
					{ kind: "modify", path: "modify.md", content: "unique-modify-v2-67890" },
					{ kind: "delete", path: "delete.md" },
				],
			});
			trash.push(dir);

			const result = yield* runAnalyze(layer, dir);
			const byPath = new Map(result.files.map((f) => [f.path, f.status] as const));
			expect(byPath.get("new.md")).toBe("added");
			expect(byPath.get("modify.md")).toBe("modified");
			expect(byPath.get("delete.md")).toBe("deleted");
			expect(byPath.get("keep.md")).toBeUndefined();
		}),
	);

	it.effect("filters the branch's own .changeset/*.md entries from files and unmappedFiles (#216)", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [{ path: "src/code.ts", content: "export const a = 1;\n" }],
				featureChanges: [
					{ kind: "modify", path: "src/code.ts", content: "export const a = 2;\n" },
					{ kind: "add", path: ".changeset/brave-foxes-dance.md", content: '---\n"@x/a": patch\n---\n\nnote\n' },
					{ kind: "add", path: ".changeset/config.json", content: "{}\n" },
				],
			});
			trash.push(dir);

			const result = yield* runAnalyze(layer, dir);
			const paths = result.files.map((f) => f.path);
			expect(paths).toContain("src/code.ts");
			// The changeset entry is the artifact being reconciled — never noise to ask about.
			expect(paths).not.toContain(".changeset/brave-foxes-dance.md");
			expect(result.unmappedFiles).not.toContain(".changeset/brave-foxes-dance.md");
			// Non-markdown .changeset files (e.g. config.json) are still reported.
			expect(paths).toContain(".changeset/config.json");
		}),
	);

	it.effect("reports renames with the new path and `renamed` status", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [{ path: "old-name.md", content: "stays the same" }],
				featureChanges: [{ kind: "rename", from: "old-name.md", to: "new-name.md" }],
			});
			trash.push(dir);

			const result = yield* runAnalyze(layer, dir);
			expect(result.files).toHaveLength(1);
			expect(result.files[0].path).toBe("new-name.md");
			expect(result.files[0].status).toBe("renamed");
		}),
	);

	it.effect("classifies each file via ConfigInspector and aggregates packagesAffected + unmappedFiles", () =>
		Effect.gen(function* () {
			// The inspected config depends on the temp dir, which `setupGitFixture`
			// creates. Stage the fixture with a placeholder inspected config, then
			// rebuild the layer below with one that knows the real project dir.
			const { dir } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [],
				featureChanges: [
					{ kind: "add", path: "packages/foo/src/index.ts", content: "export {}" },
					{ kind: "add", path: "plugin/SKILL.md", content: "" },
					{ kind: "add", path: "totally/unmapped.txt", content: "" },
				],
			});
			trash.push(dir);

			const realLayer = BranchAnalyzer.layer.pipe(
				Layer.provide(
					makeConfigInspectorTest(
						inspectedConfig(dir, {
							packages: [
								{
									name: "@scope/foo",
									workspaceDir: join(dir, "packages/foo"),
									version: "1.0.0",
									additionalScopes: ["plugin/**"],
									additionalScopeFiles: [join(dir, "plugin/SKILL.md")],
									versionFiles: [],
								},
							],
						}),
					),
				),
				Layer.provide(NodeServices.layer),
			);

			const result = yield* runAnalyze(realLayer, dir);
			const byPath = new Map(result.files.map((f) => [f.path, f] as const));

			expect(byPath.get("packages/foo/src/index.ts")?.package).toBe("@scope/foo");
			expect(byPath.get("packages/foo/src/index.ts")?.reason).toBe("workspace");

			expect(byPath.get("plugin/SKILL.md")?.package).toBe("@scope/foo");
			expect(byPath.get("plugin/SKILL.md")?.reason).toEqual({ kind: "additionalScope", glob: "plugin/**" });

			expect(byPath.get("totally/unmapped.txt")?.package).toBeNull();
			expect(byPath.get("totally/unmapped.txt")?.reason).toBeNull();

			expect(result.packagesAffected).toEqual(["@scope/foo"]);
			expect(result.unmappedFiles).toContain("totally/unmapped.txt");
			expect(result.unmappedFiles).toHaveLength(1);
		}),
	);

	it.effect("uses the explicit baseBranch option when provided", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d, { baseBranch: "main" }),
				baseFiles: [{ path: "README.md", content: "base" }],
				featureChanges: [{ kind: "add", path: "new.md", content: "" }],
			});
			trash.push(dir);

			// Create another base-like branch and verify analyze picks it up when asked.
			git(dir, "branch", "different-base");
			const result = yield* runAnalyze(layer, dir, { baseBranch: "different-base" });
			expect(result.baseBranch).toBe("different-base");
		}),
	);

	it.effect("falls back to config baseBranch when no explicit opt is given", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d, { baseBranch: "main" }),
				baseFiles: [{ path: "f.md", content: "" }],
				featureChanges: [{ kind: "add", path: "g.md", content: "" }],
			});
			trash.push(dir);

			const result = yield* runAnalyze(layer, dir);
			expect(result.baseBranch).toBe("main");
		}),
	);

	it.effect("propagates GitError when the base branch does not exist", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [{ path: "f.md", content: "" }],
				featureChanges: [{ kind: "add", path: "g.md", content: "" }],
			});
			trash.push(dir);

			const err = yield* runAnalyzeFail(layer, dir, { baseBranch: "does-not-exist" });
			expect(err).toBeInstanceOf(GitError);
		}),
	);

	it.effect("propagates ConfigurationError when the inspector fails", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "ba-cfg-fail-"));
			trash.push(dir);
			git(dir, "init", "--quiet", "-b", "main");
			git(dir, "config", "commit.gpgsign", "false");
			writeFileSync(join(dir, "f.md"), "");
			git(dir, "add", "-A");
			git(dir, "commit", "--quiet", "-m", "base");

			// A layer whose inspector always errors with ConfigurationError.
			const inspectorModule = yield* Effect.promise(() => import("../../src/changesets/services/config-inspector.js"));
			const failingInspector = Layer.succeed(inspectorModule.ConfigInspector, {
				inspect: () => Effect.fail(new ConfigurationError({ field: "options", reason: "synthetic test failure" })),
				classify: () => Effect.fail(new ConfigurationError({ field: "options", reason: "synthetic test failure" })),
				refresh: () => Effect.void,
			});
			const layer = BranchAnalyzer.layer.pipe(Layer.provide(failingInspector), Layer.provide(NodeServices.layer));

			const err = yield* runAnalyzeFail(layer, dir);
			expect(err).toBeInstanceOf(ConfigurationError);
		}),
	);

	it.effect("includes unstaged modifications to tracked files", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [{ path: "tracked.md", content: "unique-original-12345" }],
				featureChanges: [], // no committed changes
			});
			trash.push(dir);

			// Modify the file in the working tree but DO NOT stage or commit it.
			writeFileSync(join(dir, "tracked.md"), "unique-modified-67890");

			const result = yield* runAnalyze(layer, dir);
			const entry = result.files.find((f) => f.path === "tracked.md");
			expect(entry).toBeDefined();
			expect(entry?.status).toBe("modified");
		}),
	);

	it.effect("includes staged-but-uncommitted changes", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [{ path: "tracked.md", content: "unique-original-12345" }],
				featureChanges: [],
			});
			trash.push(dir);

			// Modify + stage but do not commit.
			writeFileSync(join(dir, "tracked.md"), "unique-staged-67890");
			git(dir, "add", "tracked.md");

			const result = yield* runAnalyze(layer, dir);
			const entry = result.files.find((f) => f.path === "tracked.md");
			expect(entry).toBeDefined();
			expect(entry?.status).toBe("modified");
		}),
	);

	it.effect("includes untracked files as `added`", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [{ path: "tracked.md", content: "unique-original-12345" }],
				featureChanges: [],
			});
			trash.push(dir);

			// Write an untracked file — not added, not committed.
			writeFileSync(join(dir, "brand-new.md"), "unique-untracked-12345");

			const result = yield* runAnalyze(layer, dir);
			const entry = result.files.find((f) => f.path === "brand-new.md");
			expect(entry).toBeDefined();
			expect(entry?.status).toBe("added");
		}),
	);

	it.effect("dedupes when a file appears in both diff and untracked (which shouldn't happen, but defensively)", () =>
		Effect.gen(function* () {
			// This guards the dedupe loop: real-world git won't put the same path
			// in both `diff` and `ls-files --others`, but the dedupe ensures the
			// classifier sees one entry per path regardless.
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [{ path: "base.md", content: "x" }],
				featureChanges: [{ kind: "add", path: "f.md", content: "unique-12345" }],
			});
			trash.push(dir);

			const result = yield* runAnalyze(layer, dir);
			const matches = result.files.filter((f) => f.path === "f.md");
			expect(matches).toHaveLength(1);
		}),
	);

	it.effect("combines committed + staged + unstaged + untracked in one pass", () =>
		Effect.gen(function* () {
			const { dir, layer } = setupGitFixture({
				inspectedFor: (d) => inspectedConfig(d),
				baseFiles: [
					{ path: "base.md", content: "unique-base-12345" },
					{ path: "to-modify.md", content: "unique-orig-67890" },
				],
				featureChanges: [{ kind: "add", path: "committed.md", content: "unique-committed-fghij" }],
			});
			trash.push(dir);

			// On top of the committed feature, also modify a tracked file (unstaged)
			// and write a brand-new untracked file.
			writeFileSync(join(dir, "to-modify.md"), "unique-modified-67890");
			writeFileSync(join(dir, "untracked.md"), "unique-untracked-content");

			const result = yield* runAnalyze(layer, dir);
			const byPath = new Map(result.files.map((f) => [f.path, f.status] as const));
			expect(byPath.get("committed.md")).toBe("added");
			expect(byPath.get("to-modify.md")).toBe("modified");
			expect(byPath.get("untracked.md")).toBe("added");
			// base.md should not be in the diff.
			expect(byPath.get("base.md")).toBeUndefined();
		}),
	);
});

describe("makeBranchAnalyzerTest", () => {
	it.effect("returns a layer that always succeeds with the fixed analysis", () =>
		Effect.gen(function* () {
			const { makeBranchAnalyzerTest, BranchAnalyzer } = yield* Effect.promise(
				() => import("../../src/changesets/services/branch-analyzer.js"),
			);
			const fixed: BranchAnalysis = {
				baseBranch: "main",
				mergeBaseSha: "0000000000000000000000000000000000000000",
				files: [{ path: "foo.ts", status: "added", package: null, reason: null }],
				packagesAffected: [],
				unmappedFiles: ["foo.ts"],
			};
			const layer = makeBranchAnalyzerTest(fixed);
			const result = yield* Effect.gen(function* () {
				const analyzer = yield* BranchAnalyzer;
				return yield* analyzer.analyzeBranch("/repo", { baseBranch: "main" });
			}).pipe(Effect.provide(layer));
			expect(result).toEqual(fixed);
		}),
	);
});
