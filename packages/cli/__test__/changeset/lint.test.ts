import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { runLint } from "../../src/commands/changeset/commands/lint.js";

// `it.live`, NOT `it.effect`, throughout this suite. `runLint` emits through
// Effect's `Console.log`, and `it.effect` installs `TestConsole`, which captures
// those writes so they never reach the real `console.log` these helpers spy on.
// Under `it.effect` the two "expect no output" assertions below would pass
// VACUOUSLY (the sink is always empty) and the stdout-framing test could not
// observe the real framing it exists to pin.
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
	 * Run `runLint` and collect each line written to stdout.
	 *
	 * Machine output now flows through Effect's `Console.log` (a bare
	 * `console.log` to stdout, no logger prefix), so the capture spies on
	 * `console.log`. The assertions can then see the real framing of the
	 * emitted output and confirm the Effect logger's
	 * `[HH:MM:SS] INFO (#fiber):` prefix is absent.
	 */
	function collectLogs(dir: string, quiet: boolean) {
		return Effect.gen(function* () {
			const lines: string[] = [];
			const original = console.log;
			// biome-ignore lint/suspicious/noExplicitAny: console.log spy for capture
			console.log = ((...args: any[]): void => {
				lines.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
			}) as typeof console.log;
			// `Effect.ensuring` restores the spy on every exit path, matching the
			// `.finally()` the promise-based helper used.
			yield* Effect.ensuring(
				runLint(dir, quiet),
				Effect.sync(() => {
					console.log = original;
				}),
			);
			return lines;
		});
	}

	/**
	 * Run `runLint` and return the raw concatenated stdout text.
	 */
	function collectStdout(dir: string, quiet: boolean) {
		return Effect.gen(function* () {
			let out = "";
			const original = console.log;
			// biome-ignore lint/suspicious/noExplicitAny: console.log spy for capture
			console.log = ((...args: any[]): void => {
				out += `${args.map((a) => (typeof a === "string" ? a : String(a))).join(" ")}\n`;
			}) as typeof console.log;
			yield* Effect.ensuring(
				runLint(dir, quiet),
				Effect.sync(() => {
					console.log = original;
				}),
			);
			return out;
		});
	}

	it.live("logs 'No lint errors found.' for valid dir with quiet=false", () =>
		Effect.gen(function* () {
			writeFileSync(
				join(tempDir, "good.md"),
				'---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n',
			);

			const logs = yield* collectLogs(tempDir, false);

			expect(logs).toContain("No lint errors found.");
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.live("does not log summary for valid dir with quiet=true", () =>
		Effect.gen(function* () {
			writeFileSync(
				join(tempDir, "good.md"),
				'---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n',
			);

			const logs = yield* collectLogs(tempDir, true);

			expect(logs).toEqual([]);
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.live("sets process.exitCode=1 and logs each message for invalid files", () =>
		Effect.gen(function* () {
			writeFileSync(join(tempDir, "bad.md"), '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

			const logs = yield* collectLogs(tempDir, false);

			expect(process.exitCode).toBe(1);
			expect(logs.length).toBeGreaterThan(0);
			for (const log of logs) {
				// Each error line follows the file:line:col rule message format
				expect(log).toMatch(/^.+:\d+:\d+ \S+ .+$/);
			}
			// Should NOT contain the success message
			expect(logs).not.toContain("No lint errors found.");
		}),
	);

	it.live("emits violation output with no logger framing on stdout", () =>
		Effect.gen(function* () {
			writeFileSync(join(tempDir, "bad.md"), '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

			const out = yield* collectStdout(tempDir, false);

			expect(out.length).toBeGreaterThan(0);
			// Pretty (TTY) logger framing must be absent.
			expect(out).not.toMatch(/INFO \(#\d+\)/);
			expect(out).not.toMatch(/^\[\d{2}:\d{2}:\d{2}/m);
			// Logfmt (non-TTY) logger framing must also be absent: the default
			// logger wraps lines as `timestamp=... level=INFO fiber=#N message=...`.
			expect(out).not.toMatch(/level=INFO/);
			expect(out).not.toMatch(/\bfiber=#\d+/);
			expect(out).not.toMatch(/\bmessage=/);
			// Each emitted line is the bare diagnostic, file:line:col rule message.
			for (const line of out.split("\n").filter((l) => l.length > 0)) {
				expect(line).toMatch(/^.+:\d+:\d+ \S+ .+$/);
			}
		}),
	);

	it.live("logs 'No lint errors found.' for empty dir with quiet=false", () =>
		Effect.gen(function* () {
			const logs = yield* collectLogs(tempDir, false);

			expect(logs).toContain("No lint errors found.");
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.live("produces no output for empty dir with quiet=true", () =>
		Effect.gen(function* () {
			const logs = yield* collectLogs(tempDir, true);

			expect(logs).toEqual([]);
			expect(process.exitCode).toBeUndefined();
		}),
	);
});
