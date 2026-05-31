import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHuman, runAnalyzeBranch } from "../../src/commands/changeset/commands/analyze-branch.js";

type InspectedConfig = Changesets.InspectedConfig;
const { BranchAnalyzerLive, makeConfigInspectorTest } = Changesets;

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "T",
			GIT_AUTHOR_EMAIL: "t@e",
			GIT_COMMITTER_NAME: "T",
			GIT_COMMITTER_EMAIL: "t@e",
		},
	});
}

function setupGit(): { dir: string; layer: Layer.Layer<Changesets.BranchAnalyzer> } {
	const dir = mkdtempSync(join(tmpdir(), "cs-cli-ab-"));
	git(dir, "init", "--quiet", "-b", "main");
	git(dir, "config", "commit.gpgsign", "false");
	writeFileSync(join(dir, "base.md"), "base");
	git(dir, "add", "-A");
	git(dir, "commit", "--quiet", "-m", "base");
	git(dir, "checkout", "--quiet", "-b", "feature/test");
	mkdirSync(join(dir, "packages/foo"), { recursive: true });
	writeFileSync(join(dir, "packages/foo/index.ts"), "export {}");
	writeFileSync(join(dir, "outside.md"), "lonely");
	git(dir, "add", "-A");
	git(dir, "commit", "--quiet", "-m", "feat");

	const inspected: InspectedConfig = {
		configPath: join(dir, ".changeset", "config.json"),
		projectDir: dir,
		changelog: "@savvy-web/changesets/changelog",
		baseBranch: "main",
		access: "restricted",
		ignore: [],
		packages: [
			{
				name: "@scope/foo",
				workspaceDir: join(dir, "packages/foo"),
				version: "1.0.0",
				additionalScopes: [],
				additionalScopeFiles: [],
				versionFiles: [],
			},
		],
		legacyVersionFilesUsed: false,
	};
	const layer = BranchAnalyzerLive.pipe(Layer.provide(makeConfigInspectorTest(inspected)));
	return { dir, layer };
}

const silentLogger = Logger.replace(Logger.defaultLogger, Logger.none);

describe("analyze-branch – runAnalyzeBranch handler", () => {
	const trash: string[] = [];
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		while (trash.length > 0) {
			const d = trash.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
		process.exitCode = savedExitCode;
	});

	it("succeeds and returns analysis (human format)", async () => {
		const { dir, layer } = setupGit();
		trash.push(dir);
		await Effect.runPromise(
			runAnalyzeBranch(dir, Option.none(), false).pipe(Effect.provide(layer), Effect.provide(silentLogger)),
		);
		expect(process.exitCode).toBeUndefined();
	});

	it("emits valid JSON when --json is set", async () => {
		const { dir, layer } = setupGit();
		trash.push(dir);
		const logs: string[] = [];
		const captureLogger = Logger.replace(
			Logger.defaultLogger,
			Logger.make(({ message }) => {
				logs.push(String(message));
			}),
		);
		await Effect.runPromise(
			runAnalyzeBranch(dir, Option.none(), true).pipe(Effect.provide(layer), Effect.provide(captureLogger)),
		);
		expect(logs).toHaveLength(1);
		const parsed = JSON.parse(logs[0]);
		expect(parsed.baseBranch).toBe("main");
		expect(parsed.packagesAffected).toEqual(["@scope/foo"]);
		expect(parsed.unmappedFiles).toContain("outside.md");
	});

	it("sets exitCode=1 on a missing base branch (GitError)", async () => {
		const { dir, layer } = setupGit();
		trash.push(dir);
		await Effect.runPromise(
			runAnalyzeBranch(dir, Option.some("does-not-exist"), false).pipe(
				Effect.provide(layer),
				Effect.provide(silentLogger),
				Effect.ignore,
			),
		);
		expect(process.exitCode).toBe(1);
	});
});

describe("renderHuman", () => {
	it("renders an empty analysis", () => {
		const out = renderHuman({
			baseBranch: "main",
			mergeBaseSha: "abc1234",
			files: [],
			packagesAffected: [],
			unmappedFiles: [],
		});
		expect(out).toContain("Base branch:    main");
		expect(out).toContain("Merge base SHA: abc1234");
		expect(out).toContain("(none)");
	});

	it("renders files with status glyphs and unmapped section", () => {
		const out = renderHuman({
			baseBranch: "main",
			mergeBaseSha: "abc1234",
			files: [
				{ path: "packages/foo/index.ts", status: "added", package: "@scope/foo", reason: "workspace" },
				{ path: "outside.md", status: "added", package: null, reason: null },
				{
					path: "plugin/SKILL.md",
					status: "modified",
					package: "@scope/foo",
					reason: { kind: "additionalScope", glob: "plugin/**" },
				},
			],
			packagesAffected: ["@scope/foo"],
			unmappedFiles: ["outside.md"],
		});
		expect(out).toContain("A  packages/foo/index.ts");
		expect(out).toContain("M  plugin/SKILL.md");
		expect(out).toContain("<unmapped>");
		expect(out).toContain("Unmapped (1):");
	});
});
