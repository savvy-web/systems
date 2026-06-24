/**
 * Unit-level wiring test for generateMeta's two-input split (Task 4).
 *
 * Stubs runApiExtractor so no real API Extractor process runs. The stub writes a minimal
 * "{}" to apiJsonPath so that the JSON.parse(readFileSync(perEntryApiJson)) in generate.ts
 * does not throw ENOENT before assertions run.
 *
 * Asserts:
 *  - When aeInputDir !== dtsDir (splitDiagnostics=true):
 *      Run A: entryDtsPath from dtsDir, emitDocModel NOT false, onMessage is silencing no-op (not caller's)
 *      Run B: entryDtsPath from aeInputDir, emitDocModel === false, onMessage IS caller's
 *  - When aeInputDir is omitted (back-compat): single run, caller's onMessage, emitDocModel not set
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Must be called before importing the module under test. vi.mock is hoisted to the top.
vi.mock("../../src/meta/api-extractor.js", () => ({
	runApiExtractor: vi.fn((options: { apiJsonPath: string }) => {
		// Write a minimal JSON file so generate.ts can JSON.parse(readFileSync(perEntryApiJson))
		// after each run without throwing ENOENT.
		writeFileSync(options.apiJsonPath, "{}", "utf-8");
	}),
}));

import { runApiExtractor } from "../../src/meta/api-extractor.js";
// Import AFTER the mock is set up.
import { generateMeta } from "../../src/meta/generate.js";

// Cast to a vi.Mock for type-safe call inspection.
const mockRunApiExtractor = runApiExtractor as ReturnType<typeof vi.fn>;

function scaffold(): { cwd: string; dtsDir: string; aeInputDir: string } {
	const cwd = mkdtempSync(join(tmpdir(), "meta-split-"));
	writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "@scope/fixture", version: "1.0.0" }));
	writeFileSync(
		join(cwd, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				target: "ESNext",
				module: "ESNext",
				moduleResolution: "bundler",
				declaration: true,
				skipLibCheck: true,
				types: [],
			},
			include: [join(cwd, "**/*.d.ts")],
		}),
	);
	const dtsDir = join(cwd, "dist", "dev", "pkg");
	mkdirSync(dtsDir, { recursive: true });
	writeFileSync(join(dtsDir, "index.d.ts"), `export interface Public { y: number }\n`);
	writeFileSync(
		join(dtsDir, "package.json"),
		JSON.stringify({ name: "@scope/fixture", version: "1.0.0", private: false }),
	);
	// aeInputDir: a second declarations tree (doesn't need real .d.ts — runApiExtractor is mocked).
	const aeInputDir = join(cwd, "dist", "dev", "declarations");
	mkdirSync(aeInputDir, { recursive: true });
	return { cwd, dtsDir, aeInputDir };
}

describe("generateMeta — two-input split wiring", () => {
	beforeEach(() => {
		mockRunApiExtractor.mockClear();
		// Reset the implementation each test so the file-write stub is fresh.
		mockRunApiExtractor.mockImplementation((options: { apiJsonPath: string }) => {
			writeFileSync(options.apiJsonPath, "{}", "utf-8");
		});
	});

	it("calls runApiExtractor TWICE when aeInputDir !== dtsDir (split mode)", async () => {
		const { cwd, dtsDir, aeInputDir } = scaffold();
		const outMetaDir = join(cwd, "dist", "prod", "npm", "meta");
		const callerOnMessage = vi.fn();

		await generateMeta({
			cwd,
			packageName: "@scope/fixture",
			tsconfigPath: join(cwd, "tsconfig.json"),
			dtsDir,
			aeInputDir,
			entries: { index: "index" },
			exportPaths: { index: "." },
			outMetaDir,
			localPaths: [],
			tsdoc: { suppressWarnings: [], tagDefinitions: [] },
			onMessage: callerOnMessage,
		});

		expect(mockRunApiExtractor).toHaveBeenCalledTimes(2);

		const calls = mockRunApiExtractor.mock.calls;

		// Run A — model from bundled dts.
		const runAArgs = calls[0][0] as Record<string, unknown>;
		// entryDtsPath must come from dtsDir (bundled), not aeInputDir.
		expect(runAArgs.entryDtsPath).toBe(join(dtsDir, "index.d.ts"));
		// emitDocModel must NOT be false (the model run must emit).
		expect(runAArgs.emitDocModel).not.toBe(false);
		// onMessage must be a no-op (silencing), NOT the caller's onMessage.
		expect(typeof runAArgs.onMessage).toBe("function");
		expect(runAArgs.onMessage).not.toBe(callerOnMessage);
		// onSuppressed must be absent in Run A (exactOptionalPropertyTypes: no key present).
		expect("onSuppressed" in runAArgs).toBe(false);

		// Run B — diagnostics-only from per-module declarations.
		const runBArgs = calls[1][0] as Record<string, unknown>;
		// entryDtsPath must come from aeInputDir.
		expect(runBArgs.entryDtsPath).toBe(join(aeInputDir, "index.d.ts"));
		// Must set emitDocModel: false (no model emitted from Run B).
		expect(runBArgs.emitDocModel).toBe(false);
		// onMessage must be the CALLER's onMessage.
		expect(runBArgs.onMessage).toBe(callerOnMessage);
	});

	it("calls runApiExtractor ONCE with caller's onMessage when aeInputDir is omitted (back-compat)", async () => {
		const { cwd, dtsDir } = scaffold();
		const outMetaDir = join(cwd, "dist", "prod", "npm", "meta");
		const callerOnMessage = vi.fn();

		await generateMeta({
			cwd,
			packageName: "@scope/fixture",
			tsconfigPath: join(cwd, "tsconfig.json"),
			dtsDir,
			// No aeInputDir — legacy single-run behavior.
			entries: { index: "index" },
			exportPaths: { index: "." },
			outMetaDir,
			localPaths: [],
			tsdoc: { suppressWarnings: [], tagDefinitions: [] },
			onMessage: callerOnMessage,
		});

		expect(mockRunApiExtractor).toHaveBeenCalledTimes(1);

		const singleArgs = mockRunApiExtractor.mock.calls[0][0] as Record<string, unknown>;
		// Single run uses dtsDir.
		expect(singleArgs.entryDtsPath).toBe(join(dtsDir, "index.d.ts"));
		// Caller's onMessage is routed directly.
		expect(singleArgs.onMessage).toBe(callerOnMessage);
		// No emitDocModel: false in back-compat mode.
		expect(singleArgs.emitDocModel).not.toBe(false);
	});

	it("calls runApiExtractor ONCE with no onMessage when neither aeInputDir nor caller onMessage provided", async () => {
		const { cwd, dtsDir } = scaffold();
		const outMetaDir = join(cwd, "dist", "prod", "npm", "meta");

		await generateMeta({
			cwd,
			packageName: "@scope/fixture",
			tsconfigPath: join(cwd, "tsconfig.json"),
			dtsDir,
			entries: { index: "index" },
			exportPaths: { index: "." },
			outMetaDir,
			localPaths: [],
			tsdoc: { suppressWarnings: [], tagDefinitions: [] },
			// No onMessage, no aeInputDir.
		});

		expect(mockRunApiExtractor).toHaveBeenCalledTimes(1);
		const singleArgs = mockRunApiExtractor.mock.calls[0][0] as Record<string, unknown>;
		// No onMessage key at all (exactOptionalPropertyTypes).
		expect("onMessage" in singleArgs).toBe(false);
	});
});
