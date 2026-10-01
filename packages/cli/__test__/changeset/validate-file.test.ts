import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

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
			yield* runValidateFile(filePath).pipe(Effect.provide(Capture.layer(logs, stderrLines)));
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
			// One report, one unwrapped `file:line:col rule message` line per error.
			expect(logs).toHaveLength(1);
			const lines = logs[0].split("\n");
			expect(lines.length).toBeGreaterThan(0);
			for (const line of lines) {
				expect(line.startsWith(`${filePath}:`)).toBe(true);
				expect(line.slice(filePath.length)).toMatch(/^:\d+:\d+ \S+ .+$/);
			}
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
