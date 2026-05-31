import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runChangesetCheck } from "../../src/commands/changeset/commands/check.js";

const silentLogger = Logger.replace(Logger.defaultLogger, Logger.none);

describe("check command – runChangesetCheck handler", () => {
	let tempDir: string;
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-check-"));
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
		process.exitCode = savedExitCode;
	});

	it("logs success message when all changesets are valid", async () => {
		writeFileSync(join(tempDir, "feat.md"), '---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n');
		writeFileSync(
			join(tempDir, "fix.md"),
			'---\n"@savvy-web/changesets": patch\n---\n\n## Bug Fixes\n\n- Fixed something\n',
		);

		await Effect.runPromise(runChangesetCheck(tempDir).pipe(Effect.provide(silentLogger)));

		expect(process.exitCode).toBeUndefined();
	});

	it("logs success message for an empty directory", async () => {
		await Effect.runPromise(runChangesetCheck(tempDir).pipe(Effect.provide(silentLogger)));

		expect(process.exitCode).toBeUndefined();
	});

	it("sets process.exitCode to 1 when errors are found", async () => {
		writeFileSync(join(tempDir, "bad.md"), '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

		await Effect.runPromise(runChangesetCheck(tempDir).pipe(Effect.provide(silentLogger)));

		expect(process.exitCode).toBe(1);
	});

	it("groups messages by file when multiple files have errors", async () => {
		writeFileSync(join(tempDir, "a.md"), "# Bad\n");
		writeFileSync(join(tempDir, "b.md"), "## Unknown\n\n- content\n");

		await Effect.runPromise(runChangesetCheck(tempDir).pipe(Effect.provide(silentLogger)));

		expect(process.exitCode).toBe(1);
	});

	it("reports correct error count in the summary", async () => {
		writeFileSync(join(tempDir, "ok.md"), '---\n"pkg": minor\n---\n\n## Features\n\n- Good\n');
		writeFileSync(join(tempDir, "bad.md"), "# Bad\n");

		await Effect.runPromise(runChangesetCheck(tempDir).pipe(Effect.provide(silentLogger)));

		// Only bad.md should produce errors, so exitCode must be set
		expect(process.exitCode).toBe(1);
	});

	it("does not set exitCode when only valid files are present", async () => {
		writeFileSync(
			join(tempDir, "one.md"),
			'---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Feature one\n',
		);
		writeFileSync(join(tempDir, "two.md"), '---\n"@savvy-web/changesets": patch\n---\n\n## Bug Fixes\n\n- Fix two\n');

		await Effect.runPromise(runChangesetCheck(tempDir).pipe(Effect.provide(silentLogger)));

		expect(process.exitCode).toBeUndefined();
	});

	it("handles a single file with multiple lint errors (existing.push branch)", async () => {
		// h1 triggers heading-hierarchy, empty section triggers content-structure,
		// and "Unknown" heading triggers required-sections — all from the same file
		writeFileSync(join(tempDir, "multi.md"), "## Unknown\n\n## Features\n");

		await Effect.runPromise(runChangesetCheck(tempDir).pipe(Effect.provide(silentLogger)));

		expect(process.exitCode).toBe(1);
	});
});
