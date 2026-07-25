import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Logger } from "effect";

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

	function collectLogs(filePath: string): Effect.Effect<string[]> {
		return Effect.gen(function* () {
			const logs: string[] = [];
			const collectLogger = Logger.make(({ message }) => {
				logs.push(typeof message === "string" ? message : String(message));
			});
			yield* runValidateFile(filePath).pipe(Effect.provide(Logger.layer([collectLogger])));
			return logs;
		});
	}

	it.effect("exits cleanly for a valid changeset file", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "good.md");
			writeFileSync(filePath, '---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n');

			const logs = yield* collectLogs(filePath);

			expect(process.exitCode).toBeUndefined();
			expect(logs).toContain("Valid.");
		}),
	);

	it.effect("sets process.exitCode=1 and logs errors for invalid file", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "bad.md");
			writeFileSync(filePath, '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

			const logs = yield* collectLogs(filePath);

			expect(process.exitCode).toBe(1);
			expect(logs.length).toBeGreaterThan(0);
			// Should have at least one error line in file:line:col format
			expect(logs.some((l) => l.match(/:\d+:\d+ \S+ .+$/))).toBe(true);
		}),
	);

	it.effect("sets process.exitCode=1 when file does not exist", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "nonexistent.md");

			const logs = yield* collectLogs(filePath);

			expect(process.exitCode).toBe(1);
			expect(logs.some((l) => l.toLowerCase().includes("error"))).toBe(true);
		}),
	);
});
