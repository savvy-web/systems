import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { runValidateFile } from "../../src/commands/changeset/commands/validate-file.js";
import { Capture } from "../utils/capture.js";
import { TestExit } from "../utils/exit.js";

/** What the last run wrote to stderr: every log line, including a read failure. */
const stderrLines: string[] = [];

describe("runValidateFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-validate-file-"));
		TestExit.reset();
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
	});

	function collectLogs(filePath: string): Effect.Effect<string[]> {
		return Effect.gen(function* () {
			// stdout only: the findings (and the verdict) are the command's output.
			const logs: string[] = [];
			stderrLines.length = 0;
			yield* runValidateFile(filePath).pipe(
				Effect.provide(Layer.merge(Capture.layer(logs, stderrLines), Capture.piped)),
			);
			return logs;
		}).pipe(Effect.provide(TestExit.layer));
	}

	it.effect("exits cleanly for a valid changeset file", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "good.md");
			writeFileSync(filePath, '---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n');

			const logs = yield* collectLogs(filePath);

			expect(TestExit.code()).toBe(0);
			expect(logs).toEqual(["✓ Valid"]);
		}),
	);

	it.effect("sets the exit code=1 and logs errors for invalid file", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "bad.md");
			writeFileSync(filePath, '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

			const logs = yield* collectLogs(filePath);

			expect(TestExit.code()).toBe(1);
			expect(logs.length).toBeGreaterThan(0);
			// Should have at least one error line in file:line:col format
			expect(logs.some((l) => l.match(/:\d+:\d+ \S+ .+$/))).toBe(true);
		}),
	);

	it.effect("sets the exit code=1 when file does not exist", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "nonexistent.md");

			const logs = yield* collectLogs(filePath);

			expect(TestExit.code()).toBe(1);
			expect(logs).toEqual([]);
			expect(stderrLines.some((l) => l.toLowerCase().includes("error"))).toBe(true);
		}),
	);
});
