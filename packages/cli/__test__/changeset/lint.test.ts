import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runLint } from "../../src/commands/changeset/commands/lint.js";

describe("runLint", () => {
	let tempDir: string;
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-lint-"));
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
		process.exitCode = savedExitCode;
	});

	/**
	 * Run `runLint` and collect all log messages emitted via Effect.log.
	 */
	function collectLogs(dir: string, quiet: boolean): Promise<string[]> {
		const logs: string[] = [];
		const collectLogger = Logger.make(({ message }) => {
			logs.push(typeof message === "string" ? message : String(message));
		});
		const program = runLint(dir, quiet).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, collectLogger)));
		return Effect.runPromise(program).then(() => logs);
	}

	it("logs 'No lint errors found.' for valid dir with quiet=false", async () => {
		writeFileSync(join(tempDir, "good.md"), '---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n');

		const logs = await collectLogs(tempDir, false);

		expect(logs).toContain("No lint errors found.");
		expect(process.exitCode).toBeUndefined();
	});

	it("does not log summary for valid dir with quiet=true", async () => {
		writeFileSync(join(tempDir, "good.md"), '---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n');

		const logs = await collectLogs(tempDir, true);

		expect(logs).toEqual([]);
		expect(process.exitCode).toBeUndefined();
	});

	it("sets process.exitCode=1 and logs each message for invalid files", async () => {
		writeFileSync(join(tempDir, "bad.md"), '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

		const logs = await collectLogs(tempDir, false);

		expect(process.exitCode).toBe(1);
		expect(logs.length).toBeGreaterThan(0);
		for (const log of logs) {
			// Each error line follows the file:line:col rule message format
			expect(log).toMatch(/^.+:\d+:\d+ \S+ .+$/);
		}
		// Should NOT contain the success message
		expect(logs).not.toContain("No lint errors found.");
	});

	it("logs 'No lint errors found.' for empty dir with quiet=false", async () => {
		const logs = await collectLogs(tempDir, false);

		expect(logs).toContain("No lint errors found.");
		expect(process.exitCode).toBeUndefined();
	});

	it("produces no output for empty dir with quiet=true", async () => {
		const logs = await collectLogs(tempDir, true);

		expect(logs).toEqual([]);
		expect(process.exitCode).toBeUndefined();
	});
});
