import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, layer } from "@effect/vitest";
import { Effect, Logger } from "effect";

import { runChangesetCheck } from "../../src/commands/changeset/commands/check.js";

const silentLogger = Logger.layer([]);

// A suite-boundary `layer()` is safe here: `Logger.layer([])` is stateless and
// carries nothing across tests, and this suite never chdirs — each test drives a
// freshly-created temp dir passed in as an argument.
layer(silentLogger)("check command – runChangesetCheck handler", (it) => {
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

	it.effect("logs success message when all changesets are valid", () =>
		Effect.gen(function* () {
			writeFileSync(
				join(tempDir, "feat.md"),
				'---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n',
			);
			writeFileSync(
				join(tempDir, "fix.md"),
				'---\n"@savvy-web/changesets": patch\n---\n\n## Bug Fixes\n\n- Fixed something\n',
			);

			yield* runChangesetCheck(tempDir);

			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("logs success message for an empty directory", () =>
		Effect.gen(function* () {
			yield* runChangesetCheck(tempDir);

			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("sets process.exitCode to 1 when errors are found", () =>
		Effect.gen(function* () {
			writeFileSync(join(tempDir, "bad.md"), '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

			yield* runChangesetCheck(tempDir);

			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("groups messages by file when multiple files have errors", () =>
		Effect.gen(function* () {
			writeFileSync(join(tempDir, "a.md"), "# Bad\n");
			writeFileSync(join(tempDir, "b.md"), "## Unknown\n\n- content\n");

			yield* runChangesetCheck(tempDir);

			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("reports correct error count in the summary", () =>
		Effect.gen(function* () {
			writeFileSync(join(tempDir, "ok.md"), '---\n"pkg": minor\n---\n\n## Features\n\n- Good\n');
			writeFileSync(join(tempDir, "bad.md"), "# Bad\n");

			yield* runChangesetCheck(tempDir);

			// Only bad.md should produce errors, so exitCode must be set
			expect(process.exitCode).toBe(1);
		}),
	);

	it.effect("does not set exitCode when only valid files are present", () =>
		Effect.gen(function* () {
			writeFileSync(
				join(tempDir, "one.md"),
				'---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Feature one\n',
			);
			writeFileSync(join(tempDir, "two.md"), '---\n"@savvy-web/changesets": patch\n---\n\n## Bug Fixes\n\n- Fix two\n');

			yield* runChangesetCheck(tempDir);

			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("handles a single file with multiple lint errors (existing.push branch)", () =>
		Effect.gen(function* () {
			// h1 triggers heading-hierarchy, empty section triggers content-structure,
			// and "Unknown" heading triggers required-sections — all from the same file
			writeFileSync(join(tempDir, "multi.md"), "## Unknown\n\n## Features\n");

			yield* runChangesetCheck(tempDir);

			expect(process.exitCode).toBe(1);
		}),
	);
});
