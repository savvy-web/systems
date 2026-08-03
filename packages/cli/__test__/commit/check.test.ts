import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ManagedSection } from "@effected/templates";
import { WorkspaceDiscovery, WorkspaceRoot } from "@effected/workspaces";
import { ChangesetConfigReader, SilkPublishability } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { runCommitCheck } from "../../src/commands/commit/check.js";
import { generateManagedContent, runCommitInit } from "../../src/commands/commit/init.js";

/** Marker format used by silk-effects ManagedSection for "savvy-commit" tool. */
const BEGIN_MARKER = "# --- BEGIN SAVVY-COMMIT MANAGED SECTION ---";
const END_MARKER = "# --- END SAVVY-COMMIT MANAGED SECTION ---";

/** Stub WorkspaceDiscovery that returns empty packages (no workspace root needed). */
const WorkspaceDiscoveryStub = Layer.succeed(WorkspaceDiscovery, {
	listPackages: () => Effect.succeed([]),
	getPackage: () => Effect.die("not implemented"),
	importerMap: () => Effect.succeed(new Map()),
	refresh: () => Effect.void,
} as never);

/**
 * Test layer combining all required services, with logs silenced. The release
 * format now comes from `@effected/workspaces`' pure `VersioningStrategy`, so
 * the check needs the ambient publishability policy (silk's own detector, as
 * the real CLI provides) rather than a versioning layer.
 */
const TestLayer = Layer.mergeAll(
	ManagedSection.layer,
	ChangesetConfigReader.layer,
	SilkPublishability.layer,
	WorkspaceDiscoveryStub,
	WorkspaceRoot.layer.pipe(Layer.provide(NodeServices.layer)),
).pipe(Layer.provideMerge(NodeServices.layer), Layer.provide(Logger.layer([])));

describe("runCommitCheck", () => {
	it("is a valid Effect CLI command", () => {
		expect(runCommitCheck).toBeDefined();
	});
});

describe("check helpers via init re-exports", () => {
	it("extractConfigPathFromManaged finds config path in managed content", () => {
		const configPath = "lib/configs/commitlint.config.ts";
		const managedContent = `${BEGIN_MARKER}\n${generateManagedContent(configPath)}\n${END_MARKER}`;

		expect(managedContent).toContain(`commitlint --config "$ROOT/${configPath}"`);
	});

	it("managed section with correct config path is self-consistent", () => {
		const configPath = "commitlint.config.ts";
		const content = generateManagedContent(configPath);
		const fullSection = `${BEGIN_MARKER}\n${content}\n${END_MARKER}`;

		const content2 = generateManagedContent(configPath);
		const fullSection2 = `${BEGIN_MARKER}\n${content2}\n${END_MARKER}`;
		expect(fullSection).toBe(fullSection2);
	});
});

describe("runCommitCheck Effect program", () => {
	const testDir = "/tmp/commitlint-check-test";
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		rmSync(testDir, { recursive: true, force: true });
		mkdirSync(testDir, { recursive: true });
		execSync("git init", { cwd: testDir, stdio: "ignore" });
		writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "test-pkg", private: true }));
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(testDir, { recursive: true, force: true });
	});

	it.effect("runs without errors when no config exists", () =>
		Effect.gen(function* () {
			const handler = runCommitCheck();
			yield* Effect.provide(handler, TestLayer);
		}),
	);

	it.effect("runs when config file exists", () =>
		Effect.gen(function* () {
			writeFileSync(join(testDir, "commitlint.config.ts"), "export default {};");

			const handler = runCommitCheck();
			yield* Effect.provide(handler, TestLayer);
		}),
	);

	it.effect("runs when husky hook exists without managed section", () =>
		Effect.gen(function* () {
			mkdirSync(join(testDir, ".husky"), { recursive: true });
			writeFileSync(join(testDir, ".husky/commit-msg"), "#!/usr/bin/env sh\necho test\n");

			const handler = runCommitCheck();
			yield* Effect.provide(handler, TestLayer);
		}),
	);

	it.effect("runs when husky hook has managed section", () =>
		Effect.gen(function* () {
			mkdirSync(join(testDir, ".husky"), { recursive: true });
			const configPath = "lib/configs/commitlint.config.ts";
			const hookContent = `#!/usr/bin/env sh\n${BEGIN_MARKER}\n${generateManagedContent(configPath)}\n${END_MARKER}\n`;
			writeFileSync(join(testDir, ".husky/commit-msg"), hookContent);

			const handler = runCommitCheck();
			yield* Effect.provide(handler, TestLayer);
		}),
	);

	it.effect("runs when husky hook has outdated managed section", () =>
		Effect.gen(function* () {
			mkdirSync(join(testDir, ".husky"), { recursive: true });
			const hookContent = `#!/usr/bin/env sh\n${BEGIN_MARKER}\nold outdated content\n${END_MARKER}\n`;
			writeFileSync(join(testDir, ".husky/commit-msg"), hookContent);

			const handler = runCommitCheck();
			yield* Effect.provide(handler, TestLayer);
		}),
	);

	it.effect("runs when DCO file exists", () =>
		Effect.gen(function* () {
			writeFileSync(join(testDir, "DCO"), "Developer Certificate of Origin Version 1.1");
			writeFileSync(join(testDir, "commitlint.config.ts"), "export default {};");
			mkdirSync(join(testDir, ".husky"), { recursive: true });
			writeFileSync(join(testDir, ".husky/commit-msg"), "#!/usr/bin/env sh\n");

			const handler = runCommitCheck();
			yield* Effect.provide(handler, TestLayer);
		}),
	);

	it.effect("detects various config file types", () =>
		Effect.gen(function* () {
			writeFileSync(join(testDir, ".commitlintrc.json"), "{}");

			const handler = runCommitCheck();
			yield* Effect.provide(handler, TestLayer);
		}),
	);

	it.effect("validates cleanly when fully initialized via init", () =>
		Effect.gen(function* () {
			const init = runCommitInit({ force: false, config: "commitlint.config.ts" });
			yield* Effect.provide(init, TestLayer);

			const handler = runCommitCheck();
			yield* Effect.provide(handler, TestLayer);

			// init wrote all three hooks; check should find the base, commit, and hygiene sections present.
			// A dynamic `import()` is a Promise, not an Effect — it has to be
			// lifted with `Effect.promise` before it can be yielded.
			const fs = yield* Effect.promise(() => import("node:fs"));
			const commitMsg = fs.readFileSync(join(testDir, ".husky/commit-msg"), "utf8");
			expect(commitMsg).toContain("# --- BEGIN SAVVY-BASE MANAGED SECTION ---");
			expect(commitMsg).toContain("# --- BEGIN SAVVY-COMMIT MANAGED SECTION ---");
			for (const hook of [".husky/post-checkout", ".husky/post-merge", ".husky/post-commit"]) {
				const hygiene = fs.readFileSync(join(testDir, hook), "utf8");
				expect(hygiene).toContain("# --- BEGIN SAVVY-HOOKS MANAGED SECTION ---");
			}
		}),
	);
});
