/**
 * Unit-level wiring test for generateMeta's two-input split (Task 4).
 *
 * Stubs runApiExtractor so no real API Extractor process runs. The stub writes a minimal
 * "{}" to apiJsonPath so that the JSON.parse(readFileSync(perEntryApiJson)) in generate.ts
 * does not throw ENOENT before assertions run.
 *
 * Asserts:
 *  - When aeInputDir !== dtsDir (splitDiagnostics=true):
 *      Run A: entryDtsPath from dtsDir, emitDocModel NOT false, onMessage is a non-caller fn (locally it
 *             captures Run A's CI-fatal messages for the rollup-only nudge instead of the caller's onMessage)
 *      Run B: entryDtsPath from aeInputDir, emitDocModel === false, onMessage is a wrapper forwarding to caller
 *  - When aeInputDir is omitted (back-compat): single run, caller's onMessage, emitDocModel not set
 *  - Rollup-only CI-fatal handling: a fatal only in Run A is surfaced (location stripped); a fatal in both
 *    runs is reported once with Run B's location; under ci=true Run A is a pure no-op (no nudge)
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
		// onMessage is a forwarding wrapper (it records Run B's texts for rollup-only-fatal dedup),
		// so it is not the caller's reference but must forward to it.
		expect(typeof runBArgs.onMessage).toBe("function");
		expect(runBArgs.onMessage).not.toBe(callerOnMessage);
		(runBArgs.onMessage as (e: { source: string; level: string; text: string }) => void)({
			source: "api-extractor",
			level: "warn",
			text: "forwarded",
		});
		expect(callerOnMessage).toHaveBeenCalledWith(
			expect.objectContaining({ source: "api-extractor", level: "warn", text: "forwarded" }),
		);
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

	// Drive the mocked runApiExtractor's onMessage from each run. Run A reads from dtsDir (the bundled
	// rollup), Run B from aeInputDir (the per-module declarations) — branch on entryDtsPath.
	function emitFromRuns(
		dtsDir: string,
		runA: ReadonlyArray<Record<string, unknown>>,
		runB: ReadonlyArray<Record<string, unknown>>,
	): void {
		mockRunApiExtractor.mockImplementation(
			(options: { apiJsonPath: string; entryDtsPath: string; onMessage?: (e: Record<string, unknown>) => void }) => {
				writeFileSync(options.apiJsonPath, "{}", "utf-8");
				if (options.onMessage === undefined) return;
				const messages = options.entryDtsPath.startsWith(dtsDir) ? runA : runB;
				for (const m of messages) options.onMessage(m);
			},
		);
	}

	const forgotten = (symbol: string, loc: Record<string, unknown>): Record<string, unknown> => ({
		source: "api-extractor",
		level: "warn",
		code: "ae-forgotten-export",
		ciFatal: true,
		text: `The symbol "${symbol}" needs to be exported by the entry point index.d.ts`,
		...loc,
	});

	it("surfaces a CI-fatal message that exists only in the bundled rollup (Run B never saw it)", async () => {
		const { cwd, dtsDir, aeInputDir } = scaffold();
		const outMetaDir = join(cwd, "dist", "prod", "npm", "meta");
		const callerOnMessage = vi.fn();
		// Run A (rollup) reports a forgotten export with a wrong rollup location; Run B reports nothing.
		emitFromRuns(dtsDir, [forgotten("RollupOnly", { file: "index.d.ts", line: 4210, column: 1 })], []);

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

		expect(callerOnMessage).toHaveBeenCalledTimes(1);
		const surfaced = callerOnMessage.mock.calls[0][0] as Record<string, unknown>;
		expect(surfaced.code).toBe("ae-forgotten-export");
		expect(surfaced.ciFatal).toBe(true);
		expect(surfaced.text).toContain("RollupOnly");
		// The unreliable rollup location must be stripped.
		expect("file" in surfaced).toBe(false);
		expect("line" in surfaced).toBe(false);
		expect("column" in surfaced).toBe(false);
	});

	it("does not duplicate a fatal present in BOTH runs — Run B's accurate-location version wins", async () => {
		const { cwd, dtsDir, aeInputDir } = scaffold();
		const outMetaDir = join(cwd, "dist", "prod", "npm", "meta");
		const callerOnMessage = vi.fn();
		// "Shared" appears in both runs; "RollupOnly" only in Run A.
		emitFromRuns(
			dtsDir,
			[
				forgotten("Shared", { file: "index.d.ts", line: 4000, column: 1 }),
				forgotten("RollupOnly", { file: "index.d.ts", line: 4210, column: 1 }),
			],
			[forgotten("Shared", { file: "src/shared.ts", line: 10, column: 3 })],
		);

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

		const calls = callerOnMessage.mock.calls.map((c) => c[0] as Record<string, unknown>);
		const shared = calls.filter((m) => String(m.text).includes("Shared"));
		const rollupOnly = calls.filter((m) => String(m.text).includes("RollupOnly"));
		// "Shared" reported exactly once, with Run B's accurate source location.
		expect(shared).toHaveLength(1);
		expect(shared[0].file).toBe("src/shared.ts");
		expect(shared[0].line).toBe(10);
		// "RollupOnly" still surfaced once (location stripped).
		expect(rollupOnly).toHaveLength(1);
		expect("file" in (rollupOnly[0] as object)).toBe(false);
	});

	it("does NOT harvest rollup-only fatals under CI (Run A is the hard gate there)", async () => {
		const { cwd, dtsDir, aeInputDir } = scaffold();
		const outMetaDir = join(cwd, "dist", "prod", "npm", "meta");
		const callerOnMessage = vi.fn();
		// Run A would report a rollup-only fatal, but under ci=true Run A's onMessage is a pure no-op.
		emitFromRuns(dtsDir, [forgotten("RollupOnly", { file: "index.d.ts", line: 4210, column: 1 })], []);

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
			ci: true,
		});

		// Nothing surfaced from Run A; CI failure comes from the real extractor throwing, not from a nudge.
		expect(callerOnMessage).not.toHaveBeenCalled();
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
