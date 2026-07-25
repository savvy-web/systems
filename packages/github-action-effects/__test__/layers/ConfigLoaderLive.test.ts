import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, FileSystem, Layer, Schema } from "effect";
import type { ConfigLoaderError } from "../../src/errors/ConfigLoaderError.js";
import { ConfigLoaderLive } from "../../src/layers/ConfigLoaderLive.js";
import { ConfigLoader } from "../../src/services/ConfigLoader.js";

// -- Test Schema --

const TestConfig = Schema.Struct({
	name: Schema.String,
	version: Schema.Number,
});

// -- Mock FileSystem --

interface MockFileEntry {
	readonly content: string;
}

const makeMockFs = (files: Record<string, MockFileEntry>): FileSystem.FileSystem => {
	return {
		readFileString: (path: string) => {
			const entry = files[path];
			if (!entry) {
				return Effect.fail({ _tag: "SystemError", message: `File not found: ${path}` } as never);
			}
			return Effect.succeed(entry.content);
		},

		access: (path: string) => {
			if (!files[path]) {
				return Effect.fail({ _tag: "SystemError", message: `File not found: ${path}` } as never);
			}
			return Effect.void;
		},

		// Stub all other methods to satisfy the interface
		readDirectory: () => Effect.succeed([]),
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

const makeTestLayer = (files: Record<string, MockFileEntry>) =>
	Layer.provide(ConfigLoaderLive, Layer.succeed(FileSystem.FileSystem, makeMockFs(files)));

const run = <A, E>(files: Record<string, MockFileEntry>, effect: Effect.Effect<A, E, ConfigLoader>) =>
	Effect.provide(effect, makeTestLayer(files));

const runFail = <A>(files: Record<string, MockFileEntry>, effect: Effect.Effect<A, ConfigLoaderError, ConfigLoader>) =>
	Effect.flip(Effect.provide(effect, makeTestLayer(files)));

describe("ConfigLoaderLive", () => {
	describe("loadJson", () => {
		it.effect("reads, parses, and validates a JSON file", () =>
			Effect.gen(function* () {
				const files = {
					"/app/config.json": { content: JSON.stringify({ name: "myapp", version: 1 }) },
				};

				const result = yield* run(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/app/config.json", TestConfig)),
				);
				expect(result).toEqual({ name: "myapp", version: 1 });
			}),
		);

		it.effect("fails with read error for missing file", () =>
			Effect.gen(function* () {
				const error = yield* runFail(
					{},
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/missing.json", TestConfig)),
				);
				expect(error.operation).toBe("read");
				expect(error.path).toBe("/missing.json");
			}),
		);

		it.effect("fails with parse error for invalid JSON", () =>
			Effect.gen(function* () {
				const files = {
					"/bad.json": { content: "not valid json {" },
				};

				const error = yield* runFail(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/bad.json", TestConfig)),
				);
				expect(error.operation).toBe("parse");
				expect(error.path).toBe("/bad.json");
				expect(error.reason).toContain("Invalid JSON:");
			}),
		);

		it.effect("includes Error.message in parse error reason when Error is thrown", () =>
			Effect.gen(function* () {
				const files = {
					"/bad.json": { content: "not valid json {" },
				};

				const error = yield* runFail(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/bad.json", TestConfig)),
				);
				expect(error.reason).toMatch(/Invalid JSON: .+/);
			}),
		);

		it.effect("uses String(error) in parse error reason when non-Error is thrown", () =>
			Effect.gen(function* () {
				vi.spyOn(JSON, "parse").mockImplementation(() => {
					throw "string error from parse";
				});

				const files = {
					"/nonError.json": { content: '{"name":"a","version":1}' },
				};

				try {
					const error = yield* runFail(
						files,
						Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/nonError.json", TestConfig)),
					);
					expect(error.operation).toBe("parse");
					expect(error.reason).toBe("Invalid JSON: string error from parse");
				} finally {
					vi.restoreAllMocks();
				}
			}),
		);

		it.effect("fails with validate error for schema mismatch", () =>
			Effect.gen(function* () {
				const files = {
					"/wrong.json": { content: JSON.stringify({ name: 123, version: "bad" }) },
				};

				const error = yield* runFail(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/wrong.json", TestConfig)),
				);
				expect(error.operation).toBe("validate");
				expect(error.path).toBe("/wrong.json");
			}),
		);
	});

	describe("loadJsonc", () => {
		it.effect("reads, parses, and validates a JSONC file with comments", () =>
			Effect.gen(function* () {
				const jsoncContent = [
					"// This is a comment",
					"{",
					'  "name": "myapp", // inline comment',
					'  "version": 2',
					"}",
				].join("\n");

				const files = {
					"/app/config.jsonc": { content: jsoncContent },
				};

				const result = yield* run(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJsonc("/app/config.jsonc", TestConfig)),
				);
				expect(result).toEqual({ name: "myapp", version: 2 });
			}),
		);

		it.effect("fails with read error for missing file", () =>
			Effect.gen(function* () {
				const error = yield* runFail(
					{},
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJsonc("/missing.jsonc", TestConfig)),
				);
				expect(error.operation).toBe("read");
				expect(error.path).toBe("/missing.jsonc");
			}),
		);

		it.effect("fails with parse error for invalid JSONC", () =>
			Effect.gen(function* () {
				const files = {
					"/bad.jsonc": { content: "{invalid jsonc content ]]}" },
				};

				const error = yield* runFail(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJsonc("/bad.jsonc", TestConfig)),
				);
				expect(error.operation).toBe("parse");
				expect(error.reason).toContain("Invalid JSONC:");
			}),
		);

		it.effect("fails with validate error for schema mismatch", () =>
			Effect.gen(function* () {
				const files = {
					"/wrong.jsonc": { content: '{ "name": 123, "version": "bad" }' },
				};

				const error = yield* runFail(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJsonc("/wrong.jsonc", TestConfig)),
				);
				expect(error.operation).toBe("validate");
				expect(error.path).toBe("/wrong.jsonc");
			}),
		);
	});

	describe("loadYaml", () => {
		it.effect("reads, parses, and validates a YAML file", () =>
			Effect.gen(function* () {
				const yamlContent = ["name: myapp", "version: 3"].join("\n");

				const files = {
					"/app/config.yml": { content: yamlContent },
				};

				const result = yield* run(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadYaml("/app/config.yml", TestConfig)),
				);
				expect(result).toEqual({ name: "myapp", version: 3 });
			}),
		);

		it.effect("fails with read error for missing file", () =>
			Effect.gen(function* () {
				const error = yield* runFail(
					{},
					Effect.flatMap(ConfigLoader, (svc) => svc.loadYaml("/missing.yml", TestConfig)),
				);
				expect(error.operation).toBe("read");
				expect(error.path).toBe("/missing.yml");
			}),
		);

		it.effect("fails with parse error for invalid YAML", () =>
			Effect.gen(function* () {
				const files = {
					"/bad.yml": { content: "key: *undefined_alias" },
				};

				const error = yield* runFail(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadYaml("/bad.yml", TestConfig)),
				);
				expect(error.operation).toBe("parse");
				expect(error.reason).toContain("Invalid YAML:");
			}),
		);

		it.effect("fails with validate error for schema mismatch", () =>
			Effect.gen(function* () {
				const yamlContent = ["name: 123", "version: bad"].join("\n");

				const files = {
					"/wrong.yml": { content: yamlContent },
				};

				const error = yield* runFail(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadYaml("/wrong.yml", TestConfig)),
				);
				expect(error.operation).toBe("validate");
				expect(error.path).toBe("/wrong.yml");
			}),
		);
	});

	describe("exists", () => {
		it.effect("returns true when file exists", () =>
			Effect.gen(function* () {
				const files = {
					"/config.json": { content: "{}" },
				};

				const result = yield* run(
					files,
					Effect.flatMap(ConfigLoader, (svc) => svc.exists("/config.json")),
				);
				expect(result).toBe(true);
			}),
		);

		it.effect("returns false when file does not exist", () =>
			Effect.gen(function* () {
				const result = yield* run(
					{},
					Effect.flatMap(ConfigLoader, (svc) => svc.exists("/missing.json")),
				);
				expect(result).toBe(false);
			}),
		);
	});
});
