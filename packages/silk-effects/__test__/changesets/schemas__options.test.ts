import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { ConfigurationError } from "../../src/changesets/errors.js";
import { ChangesetOptionsSchema, RepoSchema, validateChangesetOptions } from "../../src/changesets/schemas/options.js";

describe("RepoSchema", () => {
	const decode = Schema.decodeUnknownSync(RepoSchema);

	it("accepts valid repo formats", () => {
		expect(decode("microsoft/vscode")).toBe("microsoft/vscode");
		expect(decode("facebook/react")).toBe("facebook/react");
		expect(decode("user-123/my_project")).toBe("user-123/my_project");
		expect(decode("a.b/c.d")).toBe("a.b/c.d");
	});

	it("rejects missing slash", () => {
		expect(() => decode("invalid")).toThrow();
	});

	it("rejects missing owner", () => {
		expect(() => decode("/repository")).toThrow();
	});

	it("rejects missing repository", () => {
		expect(() => decode("owner/")).toThrow();
	});
});

describe("ChangesetOptionsSchema", () => {
	const decode = Schema.decodeUnknownSync(ChangesetOptionsSchema);

	it("accepts minimal valid options", () => {
		const opts = decode({ repo: "owner/repo" });
		expect(opts.repo).toBe("owner/repo");
	});

	it("accepts extended options", () => {
		const opts = decode({
			repo: "owner/repo",
			commitLinks: true,
			prLinks: false,
			issueLinks: true,
			issuePrefixes: ["#", "GH-"],
		});
		expect(opts.commitLinks).toBe(true);
		expect(opts.prLinks).toBe(false);
		expect(opts.issuePrefixes).toEqual(["#", "GH-"]);
	});

	it("rejects missing repo", () => {
		expect(() => decode({})).toThrow();
	});

	it("accepts the deprecated versionFiles option", () => {
		const opts = decode({
			repo: "owner/repo",
			versionFiles: [{ glob: "plugin.json", paths: ["$.version"] }, { glob: "**/manifest.json" }],
		});
		expect(opts.versionFiles).toHaveLength(2);
		expect(opts.versionFiles?.[0].glob).toBe("plugin.json");
	});

	it("accepts the deprecated versionFiles entries with `package` field", () => {
		const opts = decode({
			repo: "owner/repo",
			versionFiles: [{ glob: "plugin.json", paths: ["$.version"], package: "@savvy-web/changesets" }],
		});
		expect(opts.versionFiles?.[0].package).toBe("@savvy-web/changesets");
	});

	it("accepts options without versionFiles", () => {
		const opts = decode({ repo: "owner/repo" });
		expect(opts.versionFiles).toBeUndefined();
	});

	it("rejects versionFiles with invalid JSONPath", () => {
		expect(() =>
			decode({
				repo: "owner/repo",
				versionFiles: [{ glob: "plugin.json", paths: ["invalid"] }],
			}),
		).toThrow();
	});

	it("rejects versionFiles with empty glob", () => {
		expect(() =>
			decode({
				repo: "owner/repo",
				versionFiles: [{ glob: "" }],
			}),
		).toThrow();
	});

	it("accepts the new `packages` shape", () => {
		const opts = decode({
			repo: "owner/repo",
			packages: {
				"@savvy-web/changesets": {
					additionalScopes: ["plugin/**"],
					versionFiles: [{ glob: "plugin/.claude-plugin/plugin.json", paths: ["$.version"] }],
				},
			},
		});
		expect(opts.packages?.["@savvy-web/changesets"]?.additionalScopes).toEqual(["plugin/**"]);
		expect(opts.packages?.["@savvy-web/changesets"]?.versionFiles).toHaveLength(1);
	});

	it("accepts the new `packages` shape with an empty record", () => {
		const opts = decode({ repo: "owner/repo", packages: {} });
		expect(opts.packages).toEqual({});
	});

	it("rejects `packages` with invalid additionalScopes glob", () => {
		expect(() =>
			decode({
				repo: "owner/repo",
				packages: { "@x/y": { additionalScopes: ["/absolute/path"] } },
			}),
		).toThrow();
	});

	it("rejects `packages` versionFiles entries that smuggle a `package` field (strict)", () => {
		const strict = Schema.decodeUnknownSync(ChangesetOptionsSchema, { onExcessProperty: "error" });
		expect(() =>
			strict({
				repo: "owner/repo",
				packages: { "@x/y": { versionFiles: [{ glob: "p.json", package: "@x/y" }] } },
			}),
		).toThrow();
	});

	it("rejects configs that declare BOTH `packages` and the deprecated `versionFiles`", () => {
		expect(() =>
			decode({
				repo: "owner/repo",
				packages: { "@x/y": { additionalScopes: ["plugin/**"] } },
				versionFiles: [{ glob: "plugin.json", package: "@x/y" }],
			}),
		).toThrow(/cannot declare both `packages` and the deprecated/);
	});
});

describe("validateChangesetOptions", () => {
	// Both helpers return the Effect itself; the tests `yield*` it under `it.effect`.
	// `runFail` keeps `Effect.flip`, so a typed ConfigurationError arrives as the success
	// value — a defect would still escape and fail the test loudly rather than be asserted on.
	const run = (input: unknown) => validateChangesetOptions(input);
	const runFail = (input: unknown) => validateChangesetOptions(input).pipe(Effect.flip);

	it.effect("succeeds with valid options", () =>
		Effect.gen(function* () {
			const opts = yield* run({ repo: "owner/repo" });
			expect(opts.repo).toBe("owner/repo");
		}),
	);

	it.effect("succeeds with extended options", () =>
		Effect.gen(function* () {
			const opts = yield* run({ repo: "owner/repo", commitLinks: true });
			expect(opts.commitLinks).toBe(true);
		}),
	);

	it.effect("fails on null input", () =>
		Effect.gen(function* () {
			const err = yield* runFail(null);
			expect(err).toBeInstanceOf(ConfigurationError);
			expect(err.field).toBe("options");
			expect(err.reason).toContain("Configuration is required");
		}),
	);

	it.effect("fails on undefined input", () =>
		Effect.gen(function* () {
			const err = yield* runFail(undefined);
			expect(err.field).toBe("options");
		}),
	);

	it.effect("fails on non-object input", () =>
		Effect.gen(function* () {
			const err = yield* runFail("not an object");
			expect(err.reason).toContain("must be an object");
		}),
	);

	it.effect("fails on missing repo", () =>
		Effect.gen(function* () {
			const err = yield* runFail({});
			expect(err.field).toBe("repo");
			expect(err.reason).toContain("Repository name is required");
		}),
	);

	it.effect("fails on invalid repo format", () =>
		Effect.gen(function* () {
			const err = yield* runFail({ repo: "invalid" });
			expect(err.field).toBe("repo");
			expect(err.reason).toContain("Invalid repository format");
		}),
	);

	it.effect("preserves prior art error message for null", () =>
		Effect.gen(function* () {
			const err = yield* runFail(null);
			expect(err.reason).toContain("@savvy-web/changesets");
		}),
	);
});
