import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { BiomeSchemaSyncLive, Lint, ManagedSectionLive, savvyBasePreamble } from "@savvy-web/silk-effects";
import { Effect, Layer, LogLevel, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runLintInit } from "../../src/commands/lint/init.js";

const TestLayer = Layer.provideMerge(Layer.merge(ManagedSectionLive, BiomeSchemaSyncLive), NodeFileSystem.layer).pipe(
	Layer.provide(Logger.minimumLogLevel(LogLevel.None)),
);

const BEGIN_BASE = "# --- BEGIN SAVVY-BASE MANAGED SECTION ---";
const END_BASE = "# --- END SAVVY-BASE MANAGED SECTION ---";
const BEGIN_LINT = "# --- BEGIN SAVVY-LINT MANAGED SECTION ---";
const END_LINT = "# --- END SAVVY-LINT MANAGED SECTION ---";
const BEGIN_HOOKS = "# --- BEGIN SAVVY-HOOKS MANAGED SECTION ---";
const END_HOOKS = "# --- END SAVVY-HOOKS MANAGED SECTION ---";

describe("savvyLintBlock", () => {
	it("renders the one-line tool invocation", () => {
		expect(Lint.savvyLintBlock("lib/configs/lint-staged.config.ts").content).toBe(
			'in_ci || pm_exec lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"',
		);
	});

	it("uses the savvy-lint toolName", () => {
		expect(Lint.savvyLintBlock("lint-staged.config.ts").toolName).toBe("savvy-lint");
	});
});

describe("generateManagedContent", () => {
	it("is the one-line savvy-lint tool invocation with the config path", () => {
		expect(Lint.generateManagedContent("lib/configs/lint-staged.config.ts")).toBe(
			'in_ci || pm_exec lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"',
		);
	});

	it("calls the shared pm_exec helper (PM dispatch lives in savvy-base)", () => {
		const content = Lint.generateManagedContent("lint-staged.config.ts");
		expect(content).toContain("pm_exec lint-staged");
		expect(content).toContain("in_ci ||");
		expect(content).not.toContain("detect_pm");
		expect(content).not.toContain("$GITHUB_ACTIONS");
		expect(content).not.toContain("bunx ");
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
		// `bunx` substring would match `bunx`-as-shim usage; ensure we only see `bun x`.
		expect(preamble).not.toMatch(/\bbunx\b/);
	});
});

describe("runLintInit Effect program", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = join(
			tmpdir(),
			`lint-staged-init-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(testDir, { recursive: true, force: true });
	});

	it("creates pre-commit, hygiene hooks, and config file from scratch", async () => {
		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
		expect(preCommit).toContain(BEGIN_BASE);
		expect(preCommit).toContain(END_BASE);
		expect(preCommit).toContain(BEGIN_LINT);
		expect(preCommit).toContain(END_LINT);
		expect(preCommit).toContain("#!/usr/bin/env sh");

		for (const hook of [".husky/post-checkout", ".husky/post-merge", ".husky/post-commit"]) {
			const content = readFileSync(join(testDir, hook), "utf8");
			expect(content).toContain(BEGIN_HOOKS);
			expect(content).toContain(END_HOOKS);
			expect(content).toContain("git config core.fileMode false");
			expect(content).toContain("#!/usr/bin/env sh");
		}

		const configContent = readFileSync(join(testDir, "lint-staged.config.ts"), "utf8");
		expect(configContent).toContain("Preset.silk()");
	});

	it("writes savvy-base before savvy-lint in pre-commit", async () => {
		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
		const baseIdx = preCommit.indexOf(BEGIN_BASE);
		const lintIdx = preCommit.indexOf(BEGIN_LINT);
		expect(baseIdx).toBeGreaterThanOrEqual(0);
		expect(lintIdx).toBeGreaterThanOrEqual(0);
		expect(baseIdx).toBeLessThan(lintIdx);
		expect(preCommit).toContain('pm_exec lint-staged --config "$ROOT/lint-staged.config.ts"');
	});

	it("preserves custom shell above the pre-commit managed sections", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		writeFileSync(join(testDir, ".husky/pre-commit"), "#!/usr/bin/env sh\n# my custom hook\necho 'before'\n");

		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
		expect(preCommit).toContain("# my custom hook");
		expect(preCommit).toContain("echo 'before'");
		expect(preCommit).toContain(BEGIN_BASE);
		expect(preCommit).toContain(BEGIN_LINT);
	});

	it("force-overwrites entire pre-commit file but not hygiene hooks", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		writeFileSync(join(testDir, ".husky/pre-commit"), "#!/usr/bin/env sh\n# custom\n");
		// pre-existing user content in post-checkout that --force must preserve
		writeFileSync(
			join(testDir, ".husky/post-checkout"),
			"#!/usr/bin/env sh\n# user hygiene preamble\necho 'keep me'\n",
		);

		const handler = runLintInit({
			force: true,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
		expect(preCommit).not.toContain("# custom");
		expect(preCommit).toContain(BEGIN_BASE);
		expect(preCommit).toContain(BEGIN_LINT);

		const postCheckout = readFileSync(join(testDir, ".husky/post-checkout"), "utf8");
		expect(postCheckout).toContain("echo 'keep me'");
		expect(postCheckout).toContain(BEGIN_HOOKS);
	});

	it("migrates legacy SAVVY-LINT hygiene section in post-checkout and post-merge", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		const legacyHygiene = `#!/usr/bin/env sh
# Post-checkout hook with savvy-lint managed section
# Custom hooks can go above or below the managed section

${BEGIN_LINT}
# DO NOT EDIT between these markers - managed by savvy-lint
if ! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }; then

git config core.fileMode false
git ls-files -z '*.sh' | xargs -0 -r chmod +x 2>/dev/null || true

fi
${END_LINT}
`;
		writeFileSync(join(testDir, ".husky/post-checkout"), legacyHygiene);
		writeFileSync(join(testDir, ".husky/post-merge"), legacyHygiene);

		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		for (const hook of [".husky/post-checkout", ".husky/post-merge", ".husky/post-commit"]) {
			const content = readFileSync(join(testDir, hook), "utf8");
			expect(content).toContain(BEGIN_HOOKS);
			expect(content).toContain(END_HOOKS);
			expect(content).not.toContain(BEGIN_LINT);
			expect(content).not.toContain(END_LINT);
		}
	});

	it("rewrites legacy pre-commit SAVVY-LINT block into ordered savvy-base + savvy-lint sections", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		const legacyPreCommit = `#!/usr/bin/env sh
# Pre-commit hook with savvy-lint managed section
# Custom hooks can go above or below the managed section

${BEGIN_LINT}
# DO NOT EDIT between these markers - managed by savvy-lint
if ! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }; then

ROOT=$(git rev-parse --show-toplevel)

detect_pm() {
  echo "pnpm"
}

PM=$(detect_pm)
case "$PM" in
  pnpm) pnpm exec lint-staged --config "$ROOT/lint-staged.config.ts" ;;
  yarn) yarn exec lint-staged --config "$ROOT/lint-staged.config.ts" ;;
  bun)  bunx lint-staged --config "$ROOT/lint-staged.config.ts" ;;
  *)    npx --no -- lint-staged --config "$ROOT/lint-staged.config.ts" ;;
esac

fi
${END_LINT}
`;
		writeFileSync(join(testDir, ".husky/pre-commit"), legacyPreCommit);

		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
		const baseIdx = preCommit.indexOf(BEGIN_BASE);
		const lintIdx = preCommit.indexOf(BEGIN_LINT);
		expect(baseIdx).toBeGreaterThanOrEqual(0);
		expect(lintIdx).toBeGreaterThan(baseIdx);

		// The savvy-lint section content must be replaced with the new one-liner —
		// the old multi-line case body should no longer appear inside it.
		const lintSection = preCommit.slice(preCommit.indexOf(BEGIN_LINT), preCommit.indexOf(END_LINT) + END_LINT.length);
		expect(lintSection).not.toMatch(/case "\$PM" in/);
		expect(lintSection).not.toMatch(/\bbunx\b/);
		expect(lintSection).toContain('in_ci || pm_exec lint-staged --config "$ROOT/lint-staged.config.ts"');
	});

	it("is idempotent across repeated runs", async () => {
		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));
		const first = {
			preCommit: readFileSync(join(testDir, ".husky/pre-commit"), "utf8"),
			postCheckout: readFileSync(join(testDir, ".husky/post-checkout"), "utf8"),
			postMerge: readFileSync(join(testDir, ".husky/post-merge"), "utf8"),
			postCommit: readFileSync(join(testDir, ".husky/post-commit"), "utf8"),
		};

		await Effect.runPromise(Effect.provide(handler, TestLayer));
		const second = {
			preCommit: readFileSync(join(testDir, ".husky/pre-commit"), "utf8"),
			postCheckout: readFileSync(join(testDir, ".husky/post-checkout"), "utf8"),
			postMerge: readFileSync(join(testDir, ".husky/post-merge"), "utf8"),
			postCommit: readFileSync(join(testDir, ".husky/post-commit"), "utf8"),
		};

		expect(second.preCommit).toBe(first.preCommit);
		expect(second.postCheckout).toBe(first.postCheckout);
		expect(second.postMerge).toBe(first.postMerge);
		expect(second.postCommit).toBe(first.postCommit);
	});

	it("skips hygiene hooks for minimal preset", async () => {
		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "minimal",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
		expect(preCommit).toContain(BEGIN_LINT);
		expect(() => readFileSync(join(testDir, ".husky/post-checkout"), "utf8")).toThrow();
		expect(() => readFileSync(join(testDir, ".husky/post-merge"), "utf8")).toThrow();
		expect(() => readFileSync(join(testDir, ".husky/post-commit"), "utf8")).toThrow();
	});

	it("rejects absolute config paths", async () => {
		const handler = runLintInit({
			force: false,
			config: "/absolute/path/lint-staged.config.ts",
			preset: "silk",
		});
		const result = await Effect.runPromiseExit(Effect.provide(handler, TestLayer));
		expect(result._tag).toBe("Failure");
	});
});
