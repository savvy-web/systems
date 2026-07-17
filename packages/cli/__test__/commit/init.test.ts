import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { ManagedSectionLive, savvyBasePreamble } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateManagedContent, runCommitInit } from "../../src/commands/commit/init.js";

/** Test layer combining NodeFileSystem and ManagedSectionLive, with logs silenced. */
const TestLayer = Layer.provideMerge(ManagedSectionLive, NodeFileSystem.layer).pipe(Layer.provide(Logger.layer([])));

/** Marker format used by silk-effects ManagedSection for "savvy-commit" tool. */
const BEGIN_MARKER = "# --- BEGIN SAVVY-COMMIT MANAGED SECTION ---";
const END_MARKER = "# --- END SAVVY-COMMIT MANAGED SECTION ---";

describe("generateManagedContent", () => {
	it("is the one-line savvy-commit tool invocation with the config path", () => {
		const content = generateManagedContent("lib/configs/commitlint.config.ts");
		expect(content).toBe('in_ci || pm_exec commitlint --config "$ROOT/lib/configs/commitlint.config.ts" --edit "$1"');
	});

	it("calls the shared pm_exec helper (PM dispatch lives in savvy-base)", () => {
		const content = generateManagedContent("commitlint.config.ts");
		expect(content).toContain("pm_exec commitlint");
		expect(content).toContain("in_ci ||");
		expect(content).not.toContain("detect_pm");
		expect(content).not.toContain("$GITHUB_ACTIONS");
	});
});

describe("savvyBasePreamble (shared, re-exported from silk-effects)", () => {
	it("defines ROOT, in_ci, detect_pm, PM and pm_exec with bun x and exec semantics", () => {
		const preamble = savvyBasePreamble();
		expect(preamble).toContain("ROOT=$(git rev-parse --show-toplevel)");
		expect(preamble).toContain("in_ci()");
		expect(preamble).toContain("detect_pm()");
		expect(preamble).toContain("PM=$(detect_pm)");
		expect(preamble).toContain("pnpm exec");
		expect(preamble).toContain("yarn exec");
		expect(preamble).toContain("bun x");
		expect(preamble).toContain("npx --no --");
		expect(preamble).not.toContain("yarn dlx");
	});
});

describe("runCommitInit Effect program", () => {
	const testDir = "/tmp/commitlint-init-test";
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		rmSync(testDir, { recursive: true, force: true });
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(testDir, { recursive: true, force: true });
	});

	it("creates hook and config files from scratch", async () => {
		const handler = runCommitInit({ force: false, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const hookContent = readFileSync(join(testDir, ".husky/commit-msg"), "utf8");
		expect(hookContent).toContain(BEGIN_MARKER);
		expect(hookContent).toContain(END_MARKER);
		expect(hookContent).toContain("#!/usr/bin/env sh");

		const configContent = readFileSync(join(testDir, "commitlint.config.ts"), "utf8");
		expect(configContent).toContain("CommitlintConfig");
	});

	it("updates existing hook file with managed section", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		writeFileSync(join(testDir, ".husky/commit-msg"), "#!/usr/bin/env sh\n# my custom hook\n");

		const handler = runCommitInit({ force: false, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const hookContent = readFileSync(join(testDir, ".husky/commit-msg"), "utf8");
		expect(hookContent).toContain("# my custom hook");
		expect(hookContent).toContain(BEGIN_MARKER);
		expect(hookContent).toContain(END_MARKER);
	});

	it("replaces existing managed section on update", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		const oldContent = `#!/usr/bin/env sh\n${BEGIN_MARKER}\nold content\n${END_MARKER}\n`;
		writeFileSync(join(testDir, ".husky/commit-msg"), oldContent);

		const handler = runCommitInit({ force: false, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const hookContent = readFileSync(join(testDir, ".husky/commit-msg"), "utf8");
		expect(hookContent).not.toContain("old content");
		expect(hookContent).toContain(BEGIN_MARKER);
		expect(hookContent).toContain("commitlint");
	});

	it("force-overwrites entire hook file", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		writeFileSync(join(testDir, ".husky/commit-msg"), "#!/usr/bin/env sh\n# custom\n");

		const handler = runCommitInit({ force: true, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const hookContent = readFileSync(join(testDir, ".husky/commit-msg"), "utf8");
		expect(hookContent).not.toContain("# custom");
		expect(hookContent).toContain(BEGIN_MARKER);
		expect(hookContent).toContain("# --- BEGIN SAVVY-BASE MANAGED SECTION ---");
		expect(hookContent).toContain("pm_exec commitlint");
	});

	it("does not overwrite existing config without force", async () => {
		writeFileSync(join(testDir, "commitlint.config.ts"), "// existing config");

		const handler = runCommitInit({ force: false, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const configContent = readFileSync(join(testDir, "commitlint.config.ts"), "utf8");
		expect(configContent).toBe("// existing config");
	});

	it("overwrites existing config with force", async () => {
		writeFileSync(join(testDir, "commitlint.config.ts"), "// existing config");

		const handler = runCommitInit({ force: true, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const configContent = readFileSync(join(testDir, "commitlint.config.ts"), "utf8");
		expect(configContent).toContain("CommitlintConfig");
	});

	it("creates nested config directories", async () => {
		const handler = runCommitInit({ force: false, config: "lib/configs/commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const configContent = readFileSync(join(testDir, "lib/configs/commitlint.config.ts"), "utf8");
		expect(configContent).toContain("CommitlintConfig");
	});

	it("rejects absolute config paths", async () => {
		const handler = runCommitInit({ force: false, config: "/absolute/path/config.ts" });
		const result = await Effect.runPromiseExit(Effect.provide(handler, TestLayer));
		expect(result._tag).toBe("Failure");
	});

	it("writes savvy-base before savvy-commit in commit-msg", async () => {
		const handler = runCommitInit({ force: false, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const hookContent = readFileSync(join(testDir, ".husky/commit-msg"), "utf8");
		const baseIdx = hookContent.indexOf("# --- BEGIN SAVVY-BASE MANAGED SECTION ---");
		const commitIdx = hookContent.indexOf(BEGIN_MARKER);
		expect(baseIdx).toBeGreaterThanOrEqual(0);
		expect(commitIdx).toBeGreaterThanOrEqual(0);
		expect(baseIdx).toBeLessThan(commitIdx);
		expect(hookContent).toContain("pm_exec commitlint --config");
	});

	it("creates savvy-hooks hygiene in post-checkout, post-merge, and post-commit", async () => {
		const handler = runCommitInit({ force: false, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		for (const hook of [".husky/post-checkout", ".husky/post-merge", ".husky/post-commit"]) {
			const content = readFileSync(join(testDir, hook), "utf8");
			expect(content).toContain("# --- BEGIN SAVVY-HOOKS MANAGED SECTION ---");
			expect(content).toContain("git config core.fileMode false");
			expect(content).toContain("#!/usr/bin/env sh");
		}
	});

	it("is idempotent across repeated runs", async () => {
		const handler = runCommitInit({ force: false, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(handler, TestLayer));
		const first = readFileSync(join(testDir, ".husky/commit-msg"), "utf8");

		await Effect.runPromise(Effect.provide(handler, TestLayer));
		const second = readFileSync(join(testDir, ".husky/commit-msg"), "utf8");
		expect(second).toBe(first);
	});
});
