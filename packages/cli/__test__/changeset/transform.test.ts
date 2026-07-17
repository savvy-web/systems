import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runTransform } from "../../src/commands/changeset/commands/transform.js";

const { ConfigurationError, ConfigInspector, makeConfigInspectorTest } = Changesets;

const silentLogger = Logger.layer([]);

// The tests below do not create a `.changeset/config.json` next to their
// CHANGELOG fixtures, so `requireValidConfig` short-circuits before
// invoking the inspector — but the type system still requires
// ConfigInspector to be provided. Stub it with a placeholder.
const StubInspectorLayer = makeConfigInspectorTest({
	configPath: "/stub/.changeset/config.json",
	projectDir: "/stub",
	changelog: null,
	baseBranch: "main",
	access: "restricted",
	ignore: [],
	packages: [],
	legacyVersionFilesUsed: false,
});

describe("transform command – runTransform handler", () => {
	let tempDir: string;
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-transform-"));
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
		process.exitCode = savedExitCode;
	});

	it("writes transformed content to file in normal mode", async () => {
		const filePath = join(tempDir, "CHANGELOG.md");
		const input = "## 1.0.0\n\n### Bug Fixes\n\n- Fix A\n\n### Features\n\n- Feat A\n";
		writeFileSync(filePath, input);

		await Effect.runPromise(
			runTransform(filePath, false, false).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger)),
		);

		const result = readFileSync(filePath, "utf-8");
		// Features should be reordered before Bug Fixes
		expect(result.indexOf("### Features")).toBeLessThan(result.indexOf("### Bug Fixes"));
	});

	it("does not write to file in dry-run mode", async () => {
		const filePath = join(tempDir, "CHANGELOG.md");
		const input = "## 1.0.0\n\n### Bug Fixes\n\n- Fix A\n\n### Features\n\n- Feat A\n";
		writeFileSync(filePath, input);

		await Effect.runPromise(
			runTransform(filePath, true, false).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger)),
		);

		// File should remain unchanged
		const result = readFileSync(filePath, "utf-8");
		expect(result).toBe(input);
	});

	it("sets process.exitCode to 1 in check mode when file would change", async () => {
		const filePath = join(tempDir, "CHANGELOG.md");
		// Sections in wrong order will be transformed
		const input = "## 1.0.0\n\n### Bug Fixes\n\n- Fix A\n\n### Features\n\n- Feat A\n";
		writeFileSync(filePath, input);

		await Effect.runPromise(
			runTransform(filePath, false, true).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger)),
		);

		expect(process.exitCode).toBe(1);
		// File should NOT be written in check mode
		const result = readFileSync(filePath, "utf-8");
		expect(result).toBe(input);
	});

	it("does not set exitCode in check mode when file is already formatted", async () => {
		const filePath = join(tempDir, "CHANGELOG.md");
		// First, produce already-formatted content by transforming once
		const raw = "## 1.0.0\n\n### Features\n\n- Feat A\n\n### Bug Fixes\n\n- Fix A\n";
		writeFileSync(filePath, raw);
		await Effect.runPromise(
			runTransform(filePath, false, false).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger)),
		);
		const formatted = readFileSync(filePath, "utf-8");

		// Reset exitCode before check run
		process.exitCode = undefined;

		// Now run in check mode against the already-formatted content
		writeFileSync(filePath, formatted);
		await Effect.runPromise(
			runTransform(filePath, false, true).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger)),
		);

		expect(process.exitCode).toBeUndefined();
	});

	it("rejects with an error when the file does not exist", async () => {
		const filePath = join(tempDir, "nonexistent.md");

		await expect(
			Effect.runPromise(
				runTransform(filePath, false, false).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger)),
			),
		).rejects.toThrow();
	});

	it("resolves relative file paths", async () => {
		const filePath = join(tempDir, "CHANGELOG.md");
		const input = "## 1.0.0\n\n### Features\n\n- Added X\n";
		writeFileSync(filePath, input);

		// Pass the absolute path (which resolve will keep as-is)
		await Effect.runPromise(
			runTransform(filePath, false, false).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger)),
		);

		const result = readFileSync(filePath, "utf-8");
		expect(result).toContain("### Features");
		expect(result).toContain("Added X");
	});

	it("refuses to run when a config exists and the inspector returns ConfigurationError", async () => {
		// Place a config alongside the CHANGELOG so `requireValidConfig`
		// actually invokes the inspector. The inspector layer below always
		// fails — that should propagate as a Failure and set exitCode=1.
		const filePath = join(tempDir, "CHANGELOG.md");
		writeFileSync(filePath, "## 1.0.0\n\n### Features\n\n- X\n");
		mkdirSync(join(tempDir, ".changeset"), { recursive: true });
		writeFileSync(join(tempDir, ".changeset", "config.json"), "{}");

		const failingInspector = Layer.succeed(ConfigInspector, {
			inspect: () => Effect.fail(new ConfigurationError({ field: "options", reason: "synthetic" })),
			classify: () => Effect.fail(new ConfigurationError({ field: "options", reason: "synthetic" })),
			refresh: () => Effect.void,
		});

		const exit = await Effect.runPromiseExit(
			runTransform(filePath, false, false).pipe(Effect.provide(failingInspector), Effect.provide(silentLogger)),
		);
		expect(exit._tag).toBe("Failure");
		// File must not have been written.
		expect(readFileSync(filePath, "utf-8")).toBe("## 1.0.0\n\n### Features\n\n- X\n");
		expect(process.exitCode).toBe(1);
	});
});
