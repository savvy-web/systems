import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import type { WorkspaceDetectorError } from "../../src/errors/WorkspaceDetectorError.js";
import { WorkspaceDetectorLive } from "../../src/layers/WorkspaceDetectorLive.js";
import { WorkspaceDetector } from "../../src/services/WorkspaceDetector.js";

// -- Mock FileSystem --

interface MockFileEntry {
	readonly content: string;
}

const makeMockFs = (
	files: Record<string, MockFileEntry>,
	directories: Record<string, string[]> = {},
): FileSystem.FileSystem => {
	return {
		access: (path: string) => {
			if (!files[path] && !directories[path]) {
				return Effect.fail({ _tag: "SystemError", message: `File not found: ${path}` } as never);
			}
			return Effect.void;
		},

		readFileString: (path: string) => {
			const entry = files[path];
			if (!entry) {
				return Effect.fail({ _tag: "SystemError", message: `File not found: ${path}` } as never);
			}
			return Effect.succeed(entry.content);
		},

		readDirectory: (path: string) => {
			if (path in directories) {
				const entries = directories[path];
				return Effect.succeed(entries ?? []);
			}
			return Effect.fail({ _tag: "SystemError", message: `Directory not found: ${path}` } as never);
		},

		// Stub all other methods to satisfy the interface
		writeFileString: () => Effect.void,
		chmod: () => Effect.void,
		chown: () => Effect.void,
		copy: () => Effect.void,
		copyFile: () => Effect.void,
		exists: () => Effect.succeed(true),
		link: () => Effect.void,
		makeDirectory: () => Effect.void,
		makeTempDirectory: () => Effect.succeed("/tmp/test"),
		makeTempDirectoryScoped: () => Effect.succeed("/tmp/test"),
		makeTempFile: () => Effect.succeed("/tmp/test-file"),
		makeTempFileScoped: () => Effect.succeed("/tmp/test-file"),
		open: () => Effect.die("not implemented"),
		readFile: () => Effect.die("not implemented"),
		readLink: () => Effect.succeed("/tmp"),
		realPath: () => Effect.succeed("/tmp"),
		remove: () => Effect.void,
		rename: () => Effect.void,
		sink: () => Effect.die("not implemented") as never,
		stat: () => Effect.die("not implemented"),
		stream: () => Effect.die("not implemented") as never,
		symlink: () => Effect.void,
		truncate: () => Effect.void,
		utimes: () => Effect.void,
		watch: () => Effect.die("not implemented") as never,
		writeFile: () => Effect.void,
	} as unknown as FileSystem.FileSystem;
};

const makeTestLayer = (files: Record<string, MockFileEntry>, directories: Record<string, string[]> = {}) =>
	Layer.provide(WorkspaceDetectorLive, Layer.succeed(FileSystem.FileSystem, makeMockFs(files, directories)));

const run = <A, E>(
	files: Record<string, MockFileEntry>,
	effect: Effect.Effect<A, E, WorkspaceDetector>,
	directories: Record<string, string[]> = {},
) => Effect.provide(effect, makeTestLayer(files, directories));

const runFail = (
	files: Record<string, MockFileEntry>,
	effect: Effect.Effect<unknown, WorkspaceDetectorError, WorkspaceDetector>,
	directories: Record<string, string[]> = {},
) => Effect.flip(Effect.provide(effect, makeTestLayer(files, directories)));

describe("WorkspaceDetectorLive", () => {
	describe("detect", () => {
		it.effect("detects pnpm workspace from pnpm-workspace.yaml", () =>
			Effect.gen(function* () {
				const files = {
					"pnpm-workspace.yaml": { content: "packages:\n  - packages/*\n  - apps/*\n" },
				};

				const result = yield* run(
					files,
					Effect.flatMap(WorkspaceDetector, (wd) => wd.detect()),
				);
				expect(result.type).toBe("pnpm");
				expect(result.patterns).toEqual(["packages/*", "apps/*"]);
			}),
		);

		it.effect("detects npm workspace from package.json workspaces array", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": {
						content: JSON.stringify({ workspaces: ["packages/*"] }),
					},
				};

				const result = yield* run(
					files,
					Effect.flatMap(WorkspaceDetector, (wd) => wd.detect()),
				);
				expect(result.type).toBe("npm");
				expect(result.patterns).toEqual(["packages/*"]);
			}),
		);

		it.effect("detects yarn workspace when yarn.lock present", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": {
						content: JSON.stringify({ workspaces: ["packages/*"] }),
					},
					"yarn.lock": { content: "" },
				};

				const result = yield* run(
					files,
					Effect.flatMap(WorkspaceDetector, (wd) => wd.detect()),
				);
				expect(result.type).toBe("yarn");
			}),
		);

		it.effect("detects bun workspace when bun.lock present", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": {
						content: JSON.stringify({ workspaces: ["packages/*"] }),
					},
					"bun.lock": { content: "" },
				};

				const result = yield* run(
					files,
					Effect.flatMap(WorkspaceDetector, (wd) => wd.detect()),
				);
				expect(result.type).toBe("bun");
			}),
		);

		it.effect("returns single for non-monorepo without workspaces config", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": {
						content: JSON.stringify({ name: "my-app", version: "1.0.0" }),
					},
				};

				const result = yield* run(
					files,
					Effect.flatMap(WorkspaceDetector, (wd) => wd.detect()),
				);
				expect(result.type).toBe("single");
				expect(result.patterns).toEqual(["."]);
			}),
		);
	});

	describe("listPackages", () => {
		it.effect("lists packages from workspace patterns", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": {
						content: JSON.stringify({ workspaces: ["packages/*"] }),
					},
					"packages/core/package.json": {
						content: JSON.stringify({
							name: "@scope/core",
							version: "1.0.0",
							private: false,
							dependencies: {},
						}),
					},
					"packages/utils/package.json": {
						content: JSON.stringify({
							name: "@scope/utils",
							version: "2.0.0",
							private: true,
							dependencies: { "@scope/core": "^1.0.0" },
						}),
					},
				};
				const directories = {
					packages: ["core", "utils"],
				};

				const result = yield* run(
					files,
					Effect.flatMap(WorkspaceDetector, (wd) => wd.listPackages()),
					directories,
				);
				expect(result).toHaveLength(2);
				const names = result.map((p) => p.name);
				expect(names).toContain("@scope/core");
				expect(names).toContain("@scope/utils");
			}),
		);
	});

	describe("getPackage", () => {
		it.effect("finds package by name", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": {
						content: JSON.stringify({ workspaces: ["packages/*"] }),
					},
					"packages/core/package.json": {
						content: JSON.stringify({
							name: "@scope/core",
							version: "1.0.0",
						}),
					},
				};
				const directories = {
					packages: ["core"],
				};

				const result = yield* run(
					files,
					Effect.flatMap(WorkspaceDetector, (wd) => wd.getPackage("@scope/core")),
					directories,
				);
				expect(result.name).toBe("@scope/core");
				expect(result.version).toBe("1.0.0");
			}),
		);

		it.effect("fails for unknown package", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": {
						content: JSON.stringify({ workspaces: ["packages/*"] }),
					},
				};
				const directories = {
					packages: [],
				};

				const error = yield* runFail(
					files,
					Effect.flatMap(WorkspaceDetector, (wd) => wd.getPackage("nonexistent")),
					directories,
				);
				expect(error.operation).toBe("get");
				expect(error.reason).toContain("nonexistent");
			}),
		);
	});
});
