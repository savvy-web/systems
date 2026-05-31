import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	ChangesetValidationError,
	ConfigurationError,
	GitHubApiError,
	MarkdownParseError,
} from "../../src/changesets/errors.js";

describe("ChangesetValidationError", () => {
	it("formats message with file and issues", () => {
		const err = new ChangesetValidationError({
			file: "changeset.md",
			issues: [{ path: "summary", message: "cannot be empty" }],
		});
		expect(err.message).toContain("changeset.md");
		expect(err.message).toContain("summary");
		expect(err.message).toContain("cannot be empty");
	});

	it("formats message without file", () => {
		const err = new ChangesetValidationError({
			issues: [{ path: "id", message: "required" }],
		});
		expect(err.message).toMatch(/^Changeset validation failed:/);
		expect(err.message).toContain("id");
	});

	it("has the correct _tag", () => {
		const err = new ChangesetValidationError({
			issues: [{ path: "x", message: "y" }],
		});
		expect(err._tag).toBe("ChangesetValidationError");
	});

	it("works as an Effect error", () => {
		const program = Effect.fail(
			new ChangesetValidationError({
				issues: [{ path: "test", message: "fail" }],
			}),
		).pipe(Effect.catchTag("ChangesetValidationError", (e) => Effect.succeed(e.issues.length)));
		expect(Effect.runSync(program)).toBe(1);
	});
});

describe("GitHubApiError", () => {
	it("formats message with status code", () => {
		const err = new GitHubApiError({
			operation: "fetchPR",
			statusCode: 404,
			reason: "Not found",
		});
		expect(err.message).toContain("fetchPR");
		expect(err.message).toContain("404");
		expect(err.message).toContain("Not found");
	});

	it("formats message without status code", () => {
		const err = new GitHubApiError({
			operation: "fetchUser",
			reason: "Network error",
		});
		expect(err.message).toBe("GitHub API error during fetchUser: Network error");
	});

	it("detects rate limiting (403)", () => {
		const err = new GitHubApiError({ operation: "x", statusCode: 403, reason: "r" });
		expect(err.isRateLimited).toBe(true);
		expect(err.isRetryable).toBe(true);
	});

	it("detects rate limiting (429)", () => {
		const err = new GitHubApiError({ operation: "x", statusCode: 429, reason: "r" });
		expect(err.isRateLimited).toBe(true);
	});

	it("detects retryable server errors", () => {
		const err = new GitHubApiError({ operation: "x", statusCode: 500, reason: "r" });
		expect(err.isRateLimited).toBe(false);
		expect(err.isRetryable).toBe(true);
	});

	it("marks 404 as not retryable", () => {
		const err = new GitHubApiError({ operation: "x", statusCode: 404, reason: "r" });
		expect(err.isRetryable).toBe(false);
	});

	it("marks no-status errors as not retryable", () => {
		const err = new GitHubApiError({ operation: "x", reason: "r" });
		expect(err.isRetryable).toBe(false);
	});
});

describe("MarkdownParseError", () => {
	it("formats message with source and location", () => {
		const err = new MarkdownParseError({
			source: "CHANGELOG.md",
			reason: "unexpected token",
			line: 10,
			column: 5,
		});
		expect(err.message).toBe("CHANGELOG.md:10:5: Markdown parse error: unexpected token");
	});

	it("formats message with source and line only", () => {
		const err = new MarkdownParseError({
			source: "file.md",
			reason: "bad heading",
			line: 3,
		});
		expect(err.message).toBe("file.md:3: Markdown parse error: bad heading");
	});

	it("formats message without source", () => {
		const err = new MarkdownParseError({ reason: "invalid" });
		expect(err.message).toBe("Markdown parse error: invalid");
	});
});

describe("ConfigurationError", () => {
	it("formats message with field and reason", () => {
		const err = new ConfigurationError({
			field: "repo",
			reason: "missing",
		});
		expect(err.message).toBe("Configuration error (repo): missing");
	});

	it("has the correct _tag", () => {
		const err = new ConfigurationError({ field: "x", reason: "y" });
		expect(err._tag).toBe("ConfigurationError");
	});

	it("works with Effect.catchTag", () => {
		const program = Effect.fail(new ConfigurationError({ field: "repo", reason: "missing" })).pipe(
			Effect.catchTag("ConfigurationError", (e) => Effect.succeed(e.field)),
		);
		expect(Effect.runSync(program)).toBe("repo");
	});
});
