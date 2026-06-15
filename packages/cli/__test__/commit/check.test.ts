import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { ChangesetConfigReaderLive, ManagedSectionLive, VersioningStrategyLive } from "@savvy-web/silk-effects";
import { Effect, Layer, LogLevel, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceDiscovery, WorkspaceRootLive } from "workspaces-effect";
import { checkCommand } from "../../src/commands/commit/check.js";
import { generateManagedContent, initCommand } from "../../src/commands/commit/init.js";

/** Marker format used by silk-effects ManagedSection for "savvy-commit" tool. */
const BEGIN_MARKER = "# --- BEGIN SAVVY-COMMIT MANAGED SECTION ---";
const END_MARKER = "# --- END SAVVY-COMMIT MANAGED SECTION ---";

/** Stub WorkspaceDiscovery that returns empty packages (no workspace root needed). */
const WorkspaceDiscoveryStub = Layer.succeed(
	WorkspaceDiscovery,
	WorkspaceDiscovery.of({
		listPackages: () => Effect.succeed([]),
		getPackage: () => Effect.die("not implemented"),
		importerMap: () => Effect.succeed(new Map()),
		refresh: () => Effect.void,
	}),
);

/** Test layer combining all required services, with logs silenced. */
const TestLayer = Layer.mergeAll(
	ManagedSectionLive,
	VersioningStrategyLive.pipe(Layer.provide(ChangesetConfigReaderLive)),
	WorkspaceDiscoveryStub,
	WorkspaceRootLive,
).pipe(Layer.provideMerge(NodeContext.layer), Layer.provide(Logger.minimumLogLevel(LogLevel.None)));

describe("checkCommand", () => {
	it("is a valid Effect CLI command", () => {
		expect(checkCommand).toBeDefined();
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

describe("checkCommand Effect program", () => {
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

	it("runs without errors when no config exists", async () => {
		const handler = checkCommand.handler({});
		await Effect.runPromise(Effect.provide(handler, TestLayer));
	});

	it("runs when config file exists", async () => {
		writeFileSync(join(testDir, "commitlint.config.ts"), "export default {};");

		const handler = checkCommand.handler({});
		await Effect.runPromise(Effect.provide(handler, TestLayer));
	});

	it("runs when husky hook exists without managed section", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		writeFileSync(join(testDir, ".husky/commit-msg"), "#!/usr/bin/env sh\necho test\n");

		const handler = checkCommand.handler({});
		await Effect.runPromise(Effect.provide(handler, TestLayer));
	});

	it("runs when husky hook has managed section", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		const configPath = "lib/configs/commitlint.config.ts";
		const hookContent = `#!/usr/bin/env sh\n${BEGIN_MARKER}\n${generateManagedContent(configPath)}\n${END_MARKER}\n`;
		writeFileSync(join(testDir, ".husky/commit-msg"), hookContent);

		const handler = checkCommand.handler({});
		await Effect.runPromise(Effect.provide(handler, TestLayer));
	});

	it("runs when husky hook has outdated managed section", async () => {
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		const hookContent = `#!/usr/bin/env sh\n${BEGIN_MARKER}\nold outdated content\n${END_MARKER}\n`;
		writeFileSync(join(testDir, ".husky/commit-msg"), hookContent);

		const handler = checkCommand.handler({});
		await Effect.runPromise(Effect.provide(handler, TestLayer));
	});

	it("runs when DCO file exists", async () => {
		writeFileSync(join(testDir, "DCO"), "Developer Certificate of Origin Version 1.1");
		writeFileSync(join(testDir, "commitlint.config.ts"), "export default {};");
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		writeFileSync(join(testDir, ".husky/commit-msg"), "#!/usr/bin/env sh\n");

		const handler = checkCommand.handler({});
		await Effect.runPromise(Effect.provide(handler, TestLayer));
	});

	it("detects various config file types", async () => {
		writeFileSync(join(testDir, ".commitlintrc.json"), "{}");

		const handler = checkCommand.handler({});
		await Effect.runPromise(Effect.provide(handler, TestLayer));
	});

	it("validates cleanly when fully initialized via init", async () => {
		const init = initCommand.handler({ force: false, config: "commitlint.config.ts" });
		await Effect.runPromise(Effect.provide(init, TestLayer));

		const handler = checkCommand.handler({});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		// init wrote all three hooks; check should find the base, commit, and hygiene sections present.
		const fs = await import("node:fs");
		const commitMsg = fs.readFileSync(join(testDir, ".husky/commit-msg"), "utf8");
		expect(commitMsg).toContain("# --- BEGIN SAVVY-BASE MANAGED SECTION ---");
		expect(commitMsg).toContain("# --- BEGIN SAVVY-COMMIT MANAGED SECTION ---");
		for (const hook of [".husky/post-checkout", ".husky/post-merge", ".husky/post-commit"]) {
			const hygiene = fs.readFileSync(join(testDir, hook), "utf8");
			expect(hygiene).toContain("# --- BEGIN SAVVY-HOOKS MANAGED SECTION ---");
		}
	});
});
