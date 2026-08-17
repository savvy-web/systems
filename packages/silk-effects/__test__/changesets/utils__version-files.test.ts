import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { compileAndExpand } from "@effected/walker";
import { Cause, Effect, Exit, FileSystem, Layer } from "effect";
import { systemError } from "effect/PlatformError";
// `vi` MUST come from "vitest" directly: vitest hoists `vi.mock(...)` above all
// imports, and a `vi` bound through the `@effect/vitest` re-export is not yet
// initialized at hoist time — the file then dies at load with
// "Cannot access '__vi_import_N__' before initialization", an error naming
// neither `vi` nor `@effect/vitest`.
import { vi } from "vitest";

import { VersionFiles } from "../../src/changesets/utils/version-files.js";

// The kit expansion is mocked the way the hand-rolled walkGlob (and
// tinyglobby's globSync before it) used to be. `compileAndExpand` folds
// compilation and the walk into one call, so canning it cans both — no test
// here exercises an uncompilable pattern, so nothing is lost.
vi.mock("@effected/walker", () => ({
	compileAndExpand: vi.fn(),
}));

/** Can one expansion result (all patterns). */
const canWalk = (paths: ReadonlyArray<string>) => {
	vi.mocked(compileAndExpand).mockReturnValue(Effect.succeed(paths));
};

/** Can successive expansion results (one per pattern, in call order). */
const canWalkOnce = (...results: ReadonlyArray<ReadonlyArray<string>>) => {
	for (const paths of results) {
		vi.mocked(compileAndExpand).mockReturnValueOnce(Effect.succeed(paths));
	}
};

// `VersionFiles` reads and writes through the `FileSystem` service now, so its
// tests run against a real in-memory volume instead of a `vi.mock("node:fs")`
// plus a `FileSystem.layerNoop({})` — a combination that mocked one filesystem
// while stubbing a second, and left an unarranged read answering with whatever
// the previous test's `mockReturnValue` happened to be.
//
// Provided per test rather than at the suite boundary: the seed varies per test,
// and layer memoization is per build, so one `Effect.provide` per test is what
// keeps each volume isolated AND keeps a write visible to a later read in the
// same body.
const withVolume = <A, E>(
	files: Record<string, string>,
	effect: Effect.Effect<A, E, FileSystem.FileSystem>,
): Effect.Effect<A, E> => effect.pipe(Effect.provide(MemoryFileSystem.layerWith(files)));

/** Read a file back from the volume the surrounding `withVolume` body is running against. */
const readBack = (path: string) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(path));

afterEach(() => {
	vi.resetAllMocks();
});

describe("VersionFiles.extractVersionFiles", () => {
	it("returns undefined when changelog is a plain string", () => {
		expect(VersionFiles.extractVersionFiles({ changelog: "simple-string" })).toBeUndefined();
	});

	it("returns undefined when changelog tuple has no options (length < 2)", () => {
		expect(VersionFiles.extractVersionFiles({ changelog: ["@savvy-web/changesets/changelog"] })).toBeUndefined();
	});

	it("returns undefined when options lack versionFiles", () => {
		expect(
			VersionFiles.extractVersionFiles({
				changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo" }],
			}),
		).toBeUndefined();
	});

	it("returns undefined for empty versionFiles array", () => {
		expect(
			VersionFiles.extractVersionFiles({
				changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo", versionFiles: [] }],
			}),
		).toBeUndefined();
	});

	it("parses valid versionFiles config", () => {
		const result = VersionFiles.extractVersionFiles({
			changelog: [
				"@savvy-web/changesets/changelog",
				{
					repo: "owner/repo",
					versionFiles: [{ glob: "plugin.json", paths: ["$.version"] }, { glob: "**/manifest.json" }],
				},
			],
		});

		expect(result).toHaveLength(2);
		expect(result?.[0].glob).toBe("plugin.json");
		expect(result?.[0].paths).toEqual(["$.version"]);
		expect(result?.[1].glob).toBe("**/manifest.json");
		expect(result?.[1].paths).toBeUndefined();
	});

	it("returns undefined when versionFiles fails schema validation", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const result = VersionFiles.extractVersionFiles({
			changelog: [
				"@savvy-web/changesets/changelog",
				{
					repo: "owner/repo",
					versionFiles: [{ glob: "", paths: ["invalid-path"] }],
				},
			],
		});
		expect(result).toBeUndefined();
		warnSpy.mockRestore();
	});

	it("warns when versionFiles is present but invalid", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		VersionFiles.extractVersionFiles({
			changelog: [
				"@savvy-web/changesets/changelog",
				{
					repo: "owner/repo",
					versionFiles: [{ glob: "", paths: ["invalid-path"] }],
				},
			],
		});

		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[changesets] Invalid versionFiles configuration"));
		warnSpy.mockRestore();
	});

	it("returns undefined when changelog is undefined", () => {
		expect(VersionFiles.extractVersionFiles({})).toBeUndefined();
	});
});

describe("VersionFiles.discoverVersions", () => {
	it.effect("maps workspace packages to versions", () =>
		Effect.gen(function* () {
			const packages = [
				{ name: "pkg-a", version: "1.0.0", path: "/project/packages/a" },
				{ name: "pkg-b", version: "2.0.0", path: "/project/packages/b" },
			];

			const result = yield* withVolume({}, VersionFiles.discoverVersions("/project", packages));

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ name: "pkg-a", path: "/project/packages/a", version: "1.0.0" });
			expect(result[1]).toEqual({ name: "pkg-b", path: "/project/packages/b", version: "2.0.0" });
		}),
	);

	it.effect("includes root when not in packages list", () =>
		Effect.gen(function* () {
			const result = yield* withVolume(
				{ [join(resolve("/project"), "package.json")]: JSON.stringify({ name: "root-pkg", version: "3.0.0" }) },
				VersionFiles.discoverVersions("/project", []),
			);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({ name: "root-pkg", path: resolve("/project"), version: "3.0.0" });
		}),
	);

	it.effect("deduplicates root when it appears in packages", () =>
		Effect.gen(function* () {
			const resolvedCwd = resolve("/project");
			const packages = [{ name: "my-pkg", version: "1.0.0", path: resolvedCwd }];

			const result = yield* withVolume({}, VersionFiles.discoverVersions("/project", packages));

			expect(result).toHaveLength(1);
			expect(result[0]?.name).toBe("my-pkg");
		}),
	);

	it.effect("skips packages without a version", () =>
		Effect.gen(function* () {
			const packages = [
				{ name: "pkg-a", version: "1.0.0", path: "/project/packages/a" },
				{ name: "pkg-b", version: "", path: "/project/packages/b" },
			];

			const result = yield* withVolume({}, VersionFiles.discoverVersions("/project", packages));

			expect(result).toHaveLength(1);
			expect(result[0]?.name).toBe("pkg-a");
		}),
	);

	// An unseeded root package.json is genuinely absent on the volume, so the read
	// fails typed `NotFound` and `readPackageVersion` degrades to `undefined` —
	// where the old fixture had to hand-throw an `ENOENT` from a mocked `readFileSync`.
	it.effect("omits root when its package.json is unreadable", () =>
		Effect.gen(function* () {
			const result = yield* withVolume({}, VersionFiles.discoverVersions("/project", []));

			expect(result).toHaveLength(0);
		}),
	);
});

describe("VersionFiles.resolveVersion", () => {
	const workspaces = [
		{ name: "root", path: "/project", version: "1.0.0" },
		{ name: "pkg-a", path: "/project/packages/a", version: "2.0.0" },
		{ name: "pkg-b", path: "/project/packages/b", version: "3.0.0" },
	];

	it("matches file to its nearest workspace", () => {
		expect(VersionFiles.resolveVersion("/project/packages/a/plugin.json", workspaces, "0.0.0")).toBe("2.0.0");
	});

	it("matches root-level files to root version", () => {
		expect(VersionFiles.resolveVersion("/project/config.json", workspaces, "0.0.0")).toBe("1.0.0");
	});

	it("uses longest-prefix match", () => {
		// A file in pkg-a should match pkg-a (longer prefix), not root
		expect(VersionFiles.resolveVersion("/project/packages/a/sub/deep.json", workspaces, "0.0.0")).toBe("2.0.0");
	});

	it("falls back to root version when no workspace matches", () => {
		expect(VersionFiles.resolveVersion("/other/path/file.json", workspaces, "fallback")).toBe("fallback");
	});
});

describe("VersionFiles.resolveGlobs", () => {
	it.effect("resolves glob patterns to absolute paths", () =>
		Effect.gen(function* () {
			canWalk(["plugin.json", "sub/manifest.json"]);

			const configs = [{ glob: "**/*.json" }];
			const result = yield* withVolume({}, VersionFiles.resolveGlobs(configs, "/project"));

			expect(result).toHaveLength(2);
			expect(result[0][0]).toBe(join(resolve("/project"), "plugin.json"));
			expect(result[1][0]).toBe(join(resolve("/project"), "sub/manifest.json"));
		}),
	);

	it.effect("handles multiple configs", () =>
		Effect.gen(function* () {
			canWalkOnce(["a.json"], ["b.json", "c.json"]);

			const configs = [{ glob: "a.json" }, { glob: "**/b*.json" }];
			const result = yield* withVolume({}, VersionFiles.resolveGlobs(configs, "/project"));

			expect(result).toHaveLength(3);
		}),
	);

	it.effect("returns empty array when no files match", () =>
		Effect.gen(function* () {
			canWalk([]);
			expect(yield* withVolume({}, VersionFiles.resolveGlobs([{ glob: "missing.json" }], "/project"))).toHaveLength(0);
		}),
	);
});

describe("VersionFiles.detectIndent", () => {
	it("detects 2-space indentation", () => {
		expect(VersionFiles.detectIndent('{\n  "version": "1.0.0"\n}')).toBe("  ");
	});

	it("detects 4-space indentation", () => {
		expect(VersionFiles.detectIndent('{\n    "version": "1.0.0"\n}')).toBe("    ");
	});

	it("detects tab indentation", () => {
		expect(VersionFiles.detectIndent('{\n\t"version": "1.0.0"\n}')).toBe("\t");
	});

	it("defaults to 2 spaces when no indentation found", () => {
		expect(VersionFiles.detectIndent('{"version":"1.0.0"}')).toBe("  ");
	});
});

describe("VersionFiles.updateFile", () => {
	// One-file volume: seed `content` at `path`, run the update, and read the file
	// back from the SAME volume. `written` replaces the old
	// `vi.mocked(writeFileSync).mock.calls[0][1]`, and for the no-op cases it is a
	// stronger claim than "writeFileSync was not called" — it asserts the bytes on
	// the volume are still exactly what was seeded.
	const runUpdate = (content: string, path: string, jsonPaths: readonly string[], version: string) =>
		withVolume(
			{ [path]: content },
			Effect.gen(function* () {
				const result = yield* VersionFiles.updateFile(path, jsonPaths, version);
				return { result, written: yield* readBack(path) };
			}),
		);

	it.effect("updates a single JSONPath and preserves formatting", () =>
		Effect.gen(function* () {
			const content = '{\n  "version": "1.0.0"\n}\n';
			const { result, written } = yield* runUpdate(content, "/project/plugin.json", ["$.version"], "2.0.0");

			expect(result).toBeDefined();
			expect(result?.version).toBe("2.0.0");
			expect(result?.previousValues).toEqual(["1.0.0"]);
			expect(written).toBe('{\n  "version": "2.0.0"\n}\n');
		}),
	);

	it.effect("updates multiple JSONPath expressions", () =>
		Effect.gen(function* () {
			const content = JSON.stringify({ metadata: { version: "1.0.0" }, plugins: [{ version: "1.0.0" }] }, null, 2);
			const { result } = yield* runUpdate(
				content,
				"/project/file.json",
				["$.metadata.version", "$.plugins[*].version"],
				"3.0.0",
			);

			expect(result).toBeDefined();
			expect(result?.previousValues).toEqual(["1.0.0", "1.0.0"]);
		}),
	);

	it.effect("returns undefined and does not write for a wildcard path with no matches", () =>
		Effect.gen(function* () {
			const content = '{\n\t"packages": []\n}\n';
			const { result, written } = yield* runUpdate(content, "/project/file.json", ["$.packages[*].version"], "2.0.0");

			expect(result).toBeUndefined();
			expect(written).toBe(content);
		}),
	);

	it.effect("preserves trailing newline", () =>
		Effect.gen(function* () {
			const { written } = yield* runUpdate(
				'{\n  "version": "1.0.0"\n}\n',
				"/project/file.json",
				["$.version"],
				"2.0.0",
			);
			expect(written.endsWith("\n")).toBe(true);
		}),
	);

	it.effect("does not add trailing newline when original lacks one", () =>
		Effect.gen(function* () {
			const { written } = yield* runUpdate('{\n  "version": "1.0.0"\n}', "/project/file.json", ["$.version"], "2.0.0");
			expect(written.endsWith("}\n")).toBe(false);
			expect(written.endsWith("}")).toBe(true);
		}),
	);

	it.effect("preserves an inline array layout byte-for-byte on a version bump", () =>
		Effect.gen(function* () {
			// Biome line-width style keeps short arrays on one line. JSON.stringify would
			// explode this to one element per line; the jsonc edit path must not.
			const content = '{\n\t"version": "1.0.0",\n\t"keywords": ["a", "b", "c"]\n}\n';
			const { written } = yield* runUpdate(content, "/project/plugin.json", ["$.version"], "1.0.1");
			expect(written).toBe('{\n\t"version": "1.0.1",\n\t"keywords": ["a", "b", "c"]\n}\n');
		}),
	);

	it.effect("touches only the version value in a #233-shaped plugin.json (tab-indented, nested, inline arrays)", () =>
		Effect.gen(function* () {
			const content = [
				"{",
				'\t"name": "github-actions",',
				'\t"version": "2.1.0",',
				'\t"keywords": ["github-actions", "workflows", "automation", "ci-cd", "effect"],',
				'\t"commands": {',
				'\t\t"deploy": { "args": ["--env", "prod"] }',
				"\t}",
				"}",
				"",
			].join("\n");
			const { written } = yield* runUpdate(content, "/project/.claude-plugin/plugin.json", ["$.version"], "2.1.1");
			expect(written).toBe(content.replace('"version": "2.1.0"', '"version": "2.1.1"'));
		}),
	);

	it.effect("preserves a 2-space document with a trailing newline byte-for-byte", () =>
		Effect.gen(function* () {
			const content = '{\n  "name": "pkg",\n  "version": "1.0.0"\n}\n';
			const { written } = yield* runUpdate(content, "/project/file.json", ["$.version"], "1.2.3");
			expect(written).toBe('{\n  "name": "pkg",\n  "version": "1.2.3"\n}\n');
		}),
	);

	it.effect("preserves a 2-space document without a trailing newline byte-for-byte", () =>
		Effect.gen(function* () {
			const content = '{\n  "name": "pkg",\n  "version": "1.0.0"\n}';
			const { written } = yield* runUpdate(content, "/project/file.json", ["$.version"], "1.2.3");
			expect(written).toBe('{\n  "name": "pkg",\n  "version": "1.2.3"\n}');
		}),
	);

	it.effect("preserves a tab document with a trailing newline byte-for-byte", () =>
		Effect.gen(function* () {
			const content = '{\n\t"name": "pkg",\n\t"version": "1.0.0"\n}\n';
			const { written } = yield* runUpdate(content, "/project/file.json", ["$.version"], "1.2.3");
			expect(written).toBe('{\n\t"name": "pkg",\n\t"version": "1.2.3"\n}\n');
		}),
	);

	it.effect("preserves a tab document without a trailing newline byte-for-byte", () =>
		Effect.gen(function* () {
			const content = '{\n\t"name": "pkg",\n\t"version": "1.0.0"\n}';
			const { written } = yield* runUpdate(content, "/project/file.json", ["$.version"], "1.2.3");
			expect(written).toBe('{\n\t"name": "pkg",\n\t"version": "1.2.3"\n}');
		}),
	);

	it.effect("inserts an explicit path that does not yet exist using the 2-space indent", () =>
		Effect.gen(function* () {
			const { result, written } = yield* runUpdate(
				'{\n  "name": "pkg"\n}\n',
				"/project/file.json",
				["$.version"],
				"1.0.0",
			);

			expect(result).toBeDefined();
			expect(written).toContain('  "version": "1.0.0"');
			expect(written).toContain('"name": "pkg"');
		}),
	);

	it.effect("inserts a missing property using the document's tab indent", () =>
		Effect.gen(function* () {
			const { written } = yield* runUpdate('{\n\t"name": "pkg"\n}\n', "/project/file.json", ["$.version"], "1.0.0");
			expect(written).toContain('\t"version": "1.0.0"');
		}),
	);

	it.effect("preserves comments in JSONC input while bumping the version", () =>
		Effect.gen(function* () {
			const content = '{\n\t// pinned by release automation\n\t"version": "1.0.0"\n}\n';
			const { written } = yield* runUpdate(content, "/project/file.json", ["$.version"], "2.0.0");
			expect(written).toBe('{\n\t// pinned by release automation\n\t"version": "2.0.0"\n}\n');
		}),
	);

	it.effect("updates every wildcard match while preserving formatting", () =>
		Effect.gen(function* () {
			const content = '{\n\t"packages": [\n\t\t{ "version": "1.0.0" },\n\t\t{ "version": "1.0.0" }\n\t]\n}\n';
			const { result, written } = yield* runUpdate(content, "/project/file.json", ["$.packages[*].version"], "2.0.0");

			expect(result).toBeDefined();
			expect(result?.previousValues).toEqual(["1.0.0", "1.0.0"]);
			expect(written).toBe('{\n\t"packages": [\n\t\t{ "version": "2.0.0" },\n\t\t{ "version": "2.0.0" }\n\t]\n}\n');
		}),
	);

	it.effect("returns undefined and does not write when the value is already the target version", () =>
		Effect.gen(function* () {
			const content = '{\n  "version": "2.0.0"\n}\n';
			const { result, written } = yield* runUpdate(content, "/project/file.json", ["$.version"], "2.0.0");

			expect(result).toBeUndefined();
			expect(written).toBe(content);
		}),
	);

	it.effect("inserts a version into an empty object using the default indent", () =>
		Effect.gen(function* () {
			const { result, written } = yield* runUpdate("{}", "/project/file.json", ["$.version"], "1.0.0");

			expect(result).toBeDefined();
			expect(written).toBe('{\n  "version": "1.0.0"\n}');
		}),
	);

	it.effect("does not insert an array element for an out-of-bounds index path", () =>
		Effect.gen(function* () {
			const content = '{\n\t"items": ["a"]\n}\n';
			const { result, written } = yield* runUpdate(content, "/project/file.json", ["$.items[5]"], "2.0.0");

			expect(result).toBeUndefined();
			expect(written).toBe(content);
		}),
	);

	it.effect("does not insert when the parent path does not exist", () =>
		Effect.gen(function* () {
			const { result, written } = yield* runUpdate("{}", "/project/file.json", ["$.a.b"], "2.0.0");

			expect(result).toBeUndefined();
			expect(written).toBe("{}");
		}),
	);

	it.effect("does not insert when the parent is not an object", () =>
		Effect.gen(function* () {
			const content = '{\n\t"foo": "bar"\n}\n';
			const { result, written } = yield* runUpdate(content, "/project/file.json", ["$.foo.version"], "2.0.0");

			expect(result).toBeUndefined();
			expect(written).toBe(content);
		}),
	);
});

describe("VersionFiles.processVersionFiles", () => {
	// The path-dispatching `readFileSync` mock these tests used is now just a seed:
	// each file lives at its real path on the volume, and a path nothing seeded is
	// genuinely absent instead of falling through to a hand-thrown ENOENT.
	const PKG = "/project/package.json";

	it.effect("orchestrates full flow: discover, resolve, update", () =>
		Effect.gen(function* () {
			canWalk(["plugin.json"]);
			const configs = [{ glob: "plugin.json", paths: ["$.version"] }];

			const { result, written } = yield* withVolume(
				{
					[PKG]: JSON.stringify({ name: "my-project", version: "1.5.0" }),
					"/project/plugin.json": '{\n  "version": "1.0.0"\n}\n',
				},
				Effect.gen(function* () {
					const result = yield* VersionFiles.processVersionFiles("/project", configs);
					return { result, written: yield* readBack("/project/plugin.json") };
				}),
			);

			expect(result).toHaveLength(1);
			expect(result[0].version).toBe("1.5.0");
			expect(written).toBe('{\n  "version": "1.5.0"\n}\n');
		}),
	);

	it.effect("uses dry-run mode without writing files", () =>
		Effect.gen(function* () {
			canWalk(["plugin.json"]);
			const configs = [{ glob: "plugin.json" }];
			const original = JSON.stringify({ version: "1.0.0" });

			const { result, written } = yield* withVolume(
				{ [PKG]: JSON.stringify({ name: "my-project", version: "1.5.0" }), "/project/plugin.json": original },
				Effect.gen(function* () {
					const result = yield* VersionFiles.processVersionFiles("/project", configs, true);
					return { result, written: yield* readBack("/project/plugin.json") };
				}),
			);

			expect(result).toHaveLength(1);
			expect(result[0].version).toBe("1.5.0");
			expect(written).toBe(original);
		}),
	);

	it.effect("defaults paths to $.version when not specified", () =>
		Effect.gen(function* () {
			canWalk(["test.json"]);
			const configs = [{ glob: "test.json" }];

			const result = yield* withVolume(
				{
					[PKG]: JSON.stringify({ name: "root", version: "2.0.0" }),
					"/project/test.json": JSON.stringify({ version: "1.0.0" }),
				},
				VersionFiles.processVersionFiles("/project", configs, true),
			);

			expect(result).toHaveLength(1);
			expect(result[0].jsonPaths).toEqual(["$.version"]);
		}),
	);

	it.effect("reports a pending insert in dry-run mode when a wildcard-free leaf is missing", () =>
		Effect.gen(function* () {
			// Parity with the real run: updateFile would INSERT $.version into this
			// file, so the preview must report it rather than silently omitting it.
			canWalk(["other.json"]);
			const configs = [{ glob: "other.json", paths: ["$.version"] }];
			const original = JSON.stringify({ unrelated: "field" });

			const { result, written } = yield* withVolume(
				{ [PKG]: JSON.stringify({ name: "root", version: "2.0.0" }), "/project/other.json": original },
				Effect.gen(function* () {
					const result = yield* VersionFiles.processVersionFiles("/project", configs, true);
					return { result, written: yield* readBack("/project/other.json") };
				}),
			);

			expect(result).toHaveLength(1);
			expect(result[0].version).toBe("2.0.0");
			expect(result[0].previousValues).toEqual([]);
			expect(written).toBe(original);
		}),
	);

	it.effect("skips files with no wildcard matches in dry-run mode", () =>
		Effect.gen(function* () {
			canWalk(["other.json"]);
			const configs = [{ glob: "other.json", paths: ["$.packages[*].version"] }];

			const result = yield* withVolume(
				{
					[PKG]: JSON.stringify({ name: "root", version: "2.0.0" }),
					"/project/other.json": JSON.stringify({ packages: [] }),
				},
				VersionFiles.processVersionFiles("/project", configs, true),
			);

			expect(result).toHaveLength(0);
		}),
	);

	it.effect("skips same-value files in dry-run mode, matching the real run's no-op", () =>
		Effect.gen(function* () {
			canWalk(["other.json"]);
			const configs = [{ glob: "other.json", paths: ["$.version"] }];

			const result = yield* withVolume(
				{
					[PKG]: JSON.stringify({ name: "root", version: "2.0.0" }),
					"/project/other.json": JSON.stringify({ version: "2.0.0" }),
				},
				VersionFiles.processVersionFiles("/project", configs, true),
			);

			expect(result).toHaveLength(0);
		}),
	);

	it.effect("wraps per-file errors with file path context", () =>
		Effect.gen(function* () {
			canWalk(["plugin.json"]);
			const configs = [{ glob: "plugin.json" }];

			// A REAL denial injected over a volume where the file exists, rather than a
			// hand-thrown Error from a mocked `readFileSync`: the failure now arrives on
			// the same typed `PlatformError` channel production sees.
			const denied = MemoryFileSystem.layerFaulty({
				readFileString: (path) =>
					String(path).endsWith("plugin.json")
						? Effect.fail(systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "readFileString" }))
						: undefined,
			}).pipe(
				Layer.provide(
					MemoryFileSystem.layerWith({
						[PKG]: JSON.stringify({ name: "root", version: "1.0.0" }),
						"/project/plugin.json": '{\n  "version": "1.0.0"\n}\n',
					}),
				),
			);

			// The wrapped per-file error is a DEFECT, not a typed failure (the legacy
			// path's caller-bug posture, matching the previous synchronous throw).
			// `Effect.exit` is therefore correct here and `Effect.flip` would be
			// WRONG — flip only swaps the typed channel, so the defect would escape
			// and the test would error instead of asserting. The else branch throws
			// rather than silently skipping, so a success cannot pass unnoticed.
			const exit = yield* Effect.exit(Effect.provide(VersionFiles.processVersionFiles("/project", configs), denied));
			if (Exit.isFailure(exit)) {
				expect(Cause.pretty(exit.cause)).toContain("Failed to update /project/plugin.json");
			} else {
				throw new Error("expected the per-file error to surface as a defect, but the effect succeeded");
			}
		}),
	);

	it.effect("uses explicit package name to source version instead of path matching", () =>
		Effect.gen(function* () {
			const packages = [{ name: "@savvy-web/changesets", version: "1.2.0", path: "/project/package" }];
			canWalk(["plugin/.claude-plugin/plugin.json"]);
			const configs = [
				{ glob: "plugin/.claude-plugin/plugin.json", paths: ["$.version"], package: "@savvy-web/changesets" },
			];

			const result = yield* withVolume(
				{ "/project/plugin/.claude-plugin/plugin.json": '{\n\t"version": "0.0.0"\n}\n' },
				VersionFiles.processVersionFiles("/project", configs, false, packages),
			);

			expect(result).toHaveLength(1);
			expect(result[0].version).toBe("1.2.0");
		}),
	);

	it.effect("returns empty array when no globs match", () =>
		Effect.gen(function* () {
			canWalk([]);
			const configs = [{ glob: "nonexistent.json" }];

			const result = yield* withVolume(
				{ [PKG]: JSON.stringify({ name: "root", version: "1.0.0" }) },
				VersionFiles.processVersionFiles("/project", configs),
			);

			expect(result).toHaveLength(0);
		}),
	);
});
