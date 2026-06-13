import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
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
	 * Run `runLint` and collect each line written to stdout.
	 *
	 * Machine output now flows through Effect's `Console.log` (a bare
	 * `console.log` to stdout, no logger prefix), so the capture spies on
	 * `console.log`. The assertions can then see the real framing of the
	 * emitted output and confirm the Effect logger's
	 * `[HH:MM:SS] INFO (#fiber):` prefix is absent.
	 */
	function collectLogs(dir: string, quiet: boolean): Promise<string[]> {
		const lines: string[] = [];
		const original = console.log;
		// biome-ignore lint/suspicious/noExplicitAny: console.log spy for capture
		console.log = ((...args: any[]): void => {
			lines.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
		}) as typeof console.log;
		return Effect.runPromise(runLint(dir, quiet))
			.then(() => lines)
			.finally(() => {
				console.log = original;
			});
	}

	/**
	 * Run `runLint` and return the raw concatenated stdout text.
	 */
	function collectStdout(dir: string, quiet: boolean): Promise<string> {
		let out = "";
		const original = console.log;
		// biome-ignore lint/suspicious/noExplicitAny: console.log spy for capture
		console.log = ((...args: any[]): void => {
			out += `${args.map((a) => (typeof a === "string" ? a : String(a))).join(" ")}\n`;
		}) as typeof console.log;
		return Effect.runPromise(runLint(dir, quiet))
			.then(() => out)
			.finally(() => {
				console.log = original;
			});
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

	it("emits violation output with no logger framing on stdout", async () => {
		writeFileSync(join(tempDir, "bad.md"), '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

		const out = await collectStdout(tempDir, false);

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
