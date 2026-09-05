import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ManagedSection } from "@effected/templates";
import { WorkspaceDiscovery, WorkspaceRoot } from "@effected/workspaces";
import { BiomeSchemaSync, Lint, savvyBasePreamble } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { runLintInit } from "../../src/commands/lint/init.js";

// The real `WorkspaceDiscovery` over the real `WorkspaceRoot`, not a double:
// these suites run in a bare tmpdir with no workspace root above it, so
// discovery fails root-not-found and the biome-schema pass degrades to a single
// default-directory scan — exactly what it does in a plain single-package
// project. The workspace-aware path is covered on a virtual volume in
// `__test__/lint/biome-schema-sync.test.ts`.
const WorkspaceLive = WorkspaceDiscovery.layer().pipe(Layer.provide(WorkspaceRoot.layer));

const TestLayer = Layer.provideMerge(
	Layer.mergeAll(ManagedSection.layer, BiomeSchemaSync.layer, WorkspaceLive),
	Layer.merge(NodeFileSystem.layer, NodePath.layer),
).pipe(Layer.provide(Logger.layer([])));

const BEGIN_BASE = "# --- BEGIN SAVVY-BASE MANAGED SECTION ---";
const END_BASE = "# --- END SAVVY-BASE MANAGED SECTION ---";
const BEGIN_LINT = "# --- BEGIN SAVVY-LINT MANAGED SECTION ---";
const END_LINT = "# --- END SAVVY-LINT MANAGED SECTION ---";
const BEGIN_HOOKS = "# --- BEGIN SAVVY-HOOKS MANAGED SECTION ---";
const BEGIN_TOOLCHAIN = "# --- BEGIN SAVVY-TOOLCHAIN MANAGED SECTION ---";
const END_TOOLCHAIN = "# --- END SAVVY-TOOLCHAIN MANAGED SECTION ---";
const BEGIN_INSTALL = "# --- BEGIN SAVVY-INSTALL MANAGED SECTION ---";
const END_INSTALL = "# --- END SAVVY-INSTALL MANAGED SECTION ---";
const END_HOOKS = "# --- END SAVVY-HOOKS MANAGED SECTION ---";

describe("savvyLintBlock", () => {
	it("renders the one-line tool invocation", () => {
		expect(Lint.savvyLintBlock("lib/configs/lint-staged.config.ts").content).toBe(
			'in_ci || pm_exec lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"',
		);
	});

	// The key is the UPPERCASE form because the kit renders it verbatim into the
	// markers; the section model this replaced uppercased a lowercase toolName on
	// the way in. Keeping the uppercase spelling is what makes the emitted
	// `# --- BEGIN SAVVY-LINT … ---` markers match the ones already in consumer
	// repos' hook files, so this assertion guards marker compatibility.
	it("uses the uppercased SAVVY-LINT section key", () => {
		expect(Lint.savvyLintBlock("lint-staged.config.ts").key).toBe("SAVVY-LINT");
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

	it.effect("creates pre-commit, hygiene hooks, and config file from scratch", () =>
		Effect.gen(function* () {
			const handler = runLintInit({
				force: false,
				config: "lint-staged.config.ts",
				preset: "silk",
			});
			yield* Effect.provide(handler, TestLayer);

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
		}),
	);

	it.effect("writes savvy-toolchain into post-checkout and post-merge but not post-commit", () =>
		Effect.gen(function* () {
			const handler = runLintInit({
				force: false,
				config: "lint-staged.config.ts",
				preset: "silk",
			});
			yield* Effect.provide(handler, TestLayer);

			// Drift becomes true on a pull or a branch switch, which is when these two
			// fire. post-commit fires on every commit — noisier than the drift warrants.
			for (const hook of [".husky/post-checkout", ".husky/post-merge"]) {
				const content = readFileSync(join(testDir, hook), "utf8");
				expect(content).toContain(BEGIN_TOOLCHAIN);
				expect(content).toContain(END_TOOLCHAIN);
				expect(content).toContain("devEngines.packageManager");
				// The hygiene section comes first, and the toolchain block stands alone.
				expect(content.indexOf(BEGIN_HOOKS)).toBeLessThan(content.indexOf(BEGIN_TOOLCHAIN));
			}

			const postCommit = readFileSync(join(testDir, ".husky/post-commit"), "utf8");
			expect(postCommit).toContain(BEGIN_HOOKS);
			expect(postCommit).not.toContain(BEGIN_TOOLCHAIN);
		}),
	);

	it.effect("writes savvy-install into post-checkout and post-merge but not post-commit", () =>
		Effect.gen(function* () {
			const handler = runLintInit({
				force: false,
				config: "lint-staged.config.ts",
				preset: "silk",
			});
			yield* Effect.provide(handler, TestLayer);

			// The two hooks get DIFFERENT install blocks: post-checkout is handed the
			// commit pair and the branch flag, post-merge has to recover its range from
			// ORIG_HEAD. Asserting the shared marker alone would pass with both hooks
			// carrying the same wrong variant.
			const postCheckout = readFileSync(join(testDir, ".husky/post-checkout"), "utf8");
			expect(postCheckout).toContain(BEGIN_INSTALL);
			expect(postCheckout).toContain(END_INSTALL);
			expect(postCheckout).toContain('[ "$3" = "1" ]');
			expect(postCheckout).not.toContain("ORIG_HEAD");

			const postMerge = readFileSync(join(testDir, ".husky/post-merge"), "utf8");
			expect(postMerge).toContain(BEGIN_INSTALL);
			expect(postMerge).toContain("ORIG_HEAD");
			expect(postMerge).not.toContain('[ "$3" = "1" ]');

			// post-commit fires on every commit; an install there would be intolerable.
			const postCommit = readFileSync(join(testDir, ".husky/post-commit"), "utf8");
			expect(postCommit).not.toContain(BEGIN_INSTALL);
		}),
	);

	it.effect("writes savvy-base before savvy-lint in pre-commit", () =>
		Effect.gen(function* () {
			const handler = runLintInit({
				force: false,
				config: "lint-staged.config.ts",
				preset: "silk",
			});
			yield* Effect.provide(handler, TestLayer);

			const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
			const baseIdx = preCommit.indexOf(BEGIN_BASE);
			const lintIdx = preCommit.indexOf(BEGIN_LINT);
			expect(baseIdx).toBeGreaterThanOrEqual(0);
			expect(lintIdx).toBeGreaterThanOrEqual(0);
			expect(baseIdx).toBeLessThan(lintIdx);
			expect(preCommit).toContain('pm_exec lint-staged --config "$ROOT/lint-staged.config.ts"');
		}),
	);

	it.effect("preserves custom shell above the pre-commit managed sections", () =>
		Effect.gen(function* () {
			mkdirSync(join(testDir, ".husky"), { recursive: true });
			writeFileSync(join(testDir, ".husky/pre-commit"), "#!/usr/bin/env sh\n# my custom hook\necho 'before'\n");

			const handler = runLintInit({
				force: false,
				config: "lint-staged.config.ts",
				preset: "silk",
			});
			yield* Effect.provide(handler, TestLayer);

			const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
			expect(preCommit).toContain("# my custom hook");
			expect(preCommit).toContain("echo 'before'");
			expect(preCommit).toContain(BEGIN_BASE);
			expect(preCommit).toContain(BEGIN_LINT);
		}),
	);

	it.effect("force-overwrites entire pre-commit file but not hygiene hooks", () =>
		Effect.gen(function* () {
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
			yield* Effect.provide(handler, TestLayer);

			const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
			expect(preCommit).not.toContain("# custom");
			expect(preCommit).toContain(BEGIN_BASE);
			expect(preCommit).toContain(BEGIN_LINT);

			const postCheckout = readFileSync(join(testDir, ".husky/post-checkout"), "utf8");
			expect(postCheckout).toContain("echo 'keep me'");
			expect(postCheckout).toContain(BEGIN_HOOKS);
		}),
	);

	it.effect("migrates legacy SAVVY-LINT hygiene section in post-checkout and post-merge", () =>
		Effect.gen(function* () {
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
			yield* Effect.provide(handler, TestLayer);

			for (const hook of [".husky/post-checkout", ".husky/post-merge", ".husky/post-commit"]) {
				const content = readFileSync(join(testDir, hook), "utf8");
				expect(content).toContain(BEGIN_HOOKS);
				expect(content).toContain(END_HOOKS);
				expect(content).not.toContain(BEGIN_LINT);
				expect(content).not.toContain(END_LINT);
			}
		}),
	);

	it.effect("rewrites legacy pre-commit SAVVY-LINT block into ordered savvy-base + savvy-lint sections", () =>
		Effect.gen(function* () {
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
			yield* Effect.provide(handler, TestLayer);

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
		}),
	);

	it.effect("is idempotent across repeated runs", () =>
		Effect.gen(function* () {
			const handler = runLintInit({
				force: false,
				config: "lint-staged.config.ts",
				preset: "silk",
			});
			yield* Effect.provide(handler, TestLayer);
			const first = {
				preCommit: readFileSync(join(testDir, ".husky/pre-commit"), "utf8"),
				postCheckout: readFileSync(join(testDir, ".husky/post-checkout"), "utf8"),
				postMerge: readFileSync(join(testDir, ".husky/post-merge"), "utf8"),
				postCommit: readFileSync(join(testDir, ".husky/post-commit"), "utf8"),
			};

			yield* Effect.provide(handler, TestLayer);
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
		}),
	);

	it.effect("union-merges missing template ignores into an existing markdownlint config without force", () =>
		Effect.gen(function* () {
			// Pre-existing config: missing several default ignores (incl. **/.git),
			// carries a user-added ignore, and has a drifted config rule.
			const existing = {
				...Lint.MARKDOWNLINT_TEMPLATE,
				ignores: ["**/node_modules", "**/my-vendor"],
				config: { ...Lint.MARKDOWNLINT_CONFIG, MD013: true },
			};
			mkdirSync(join(testDir, "lib/configs"), { recursive: true });
			writeFileSync(join(testDir, Lint.MARKDOWNLINT_CONFIG_PATH), `${JSON.stringify(existing, null, "\t")}\n`);

			const handler = runLintInit({
				force: false,
				config: "lint-staged.config.ts",
				preset: "silk",
			});
			yield* Effect.provide(handler, TestLayer);

			const merged = JSON.parse(readFileSync(join(testDir, Lint.MARKDOWNLINT_CONFIG_PATH), "utf8"));
			// The new default exclude is appended.
			expect(merged.ignores).toContain("**/.git");
			// The user-added entry survives.
			expect(merged.ignores).toContain("**/my-vendor");
			// Pre-existing default is not duplicated.
			expect(merged.ignores.filter((g: string) => g === "**/node_modules")).toHaveLength(1);
			// Drifted config rules are left as-is (warn-only, never auto-overwritten).
			expect(merged.config.MD013).toBe(true);
		}),
	);

	it.effect("skips hygiene hooks for minimal preset", () =>
		Effect.gen(function* () {
			const handler = runLintInit({
				force: false,
				config: "lint-staged.config.ts",
				preset: "minimal",
			});
			yield* Effect.provide(handler, TestLayer);

			const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
			expect(preCommit).toContain(BEGIN_LINT);
			expect(() => readFileSync(join(testDir, ".husky/post-checkout"), "utf8")).toThrow();
			expect(() => readFileSync(join(testDir, ".husky/post-merge"), "utf8")).toThrow();
			expect(() => readFileSync(join(testDir, ".husky/post-commit"), "utf8")).toThrow();
		}),
	);

	it.effect("rejects absolute config paths", () =>
		Effect.gen(function* () {
			const handler = runLintInit({
				force: false,
				config: "/absolute/path/lint-staged.config.ts",
				preset: "silk",
			});
			// `Effect.flip` proves the rejection arrives through the TYPED error
			// channel; the old `runPromiseExit` + `_tag === "Failure"` check would
			// also have passed if the path had escaped as a defect.
			const error = yield* Effect.flip(Effect.provide(handler, TestLayer));
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe("Config path must be relative to repository root, not absolute");
		}),
	);
});
