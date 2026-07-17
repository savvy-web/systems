import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runValidateFile } from "../../src/commands/changeset/commands/validate-file.js";

describe("runValidateFile", () => {
	let tempDir: string;
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-validate-file-"));
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
		process.exitCode = savedExitCode;
	});

	function collectLogs(filePath: string): Promise<string[]> {
		const logs: string[] = [];
		const collectLogger = Logger.make(({ message }) => {
			logs.push(typeof message === "string" ? message : String(message));
		});
		const program = runValidateFile(filePath).pipe(Effect.provide(Logger.layer([collectLogger])));
		return Effect.runPromise(program).then(() => logs);
	}

	it("exits cleanly for a valid changeset file", async () => {
		const filePath = join(tempDir, "good.md");
		writeFileSync(filePath, '---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n');

		const logs = await collectLogs(filePath);

		expect(process.exitCode).toBeUndefined();
		expect(logs).toContain("Valid.");
	});

	it("sets process.exitCode=1 and logs errors for invalid file", async () => {
		const filePath = join(tempDir, "bad.md");
		writeFileSync(filePath, '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

		const logs = await collectLogs(filePath);

		expect(process.exitCode).toBe(1);
		expect(logs.length).toBeGreaterThan(0);
		// Should have at least one error line in file:line:col format
		expect(logs.some((l) => l.match(/:\d+:\d+ \S+ .+$/))).toBe(true);
	});

	it("sets process.exitCode=1 when file does not exist", async () => {
		const filePath = join(tempDir, "nonexistent.md");

		const logs = await collectLogs(filePath);

		expect(process.exitCode).toBe(1);
		expect(logs.some((l) => l.toLowerCase().includes("error"))).toBe(true);
	});
});
