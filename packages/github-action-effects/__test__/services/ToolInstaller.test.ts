import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { ToolInstallerTest } from "../../src/layers/ToolInstallerTest.js";
import { ToolInstaller } from "../../src/services/ToolInstaller.js";

const run = <A, E>(state: ReturnType<typeof ToolInstallerTest.empty>, effect: Effect.Effect<A, E, ToolInstaller>) =>
	Effect.provide(effect, ToolInstallerTest.layer(state));

describe("ToolInstaller", () => {
	describe("find", () => {
		it.effect("returns Option.none() for uncached tools", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.find("node", "20.0.0")),
				);

				expect(Option.isNone(result)).toBe(true);
				expect(state.findCalls).toHaveLength(1);
				expect(state.findCalls[0]).toEqual({ tool: "node", version: "20.0.0" });
			}),
		);

		it.effect("returns Option.some(path) for cached tools", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();
				state.cachedTools.set("node@20.0.0", "/tools/node/20.0.0");

				const result = yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.find("node", "20.0.0")),
				);

				expect(Option.isSome(result)).toBe(true);
				expect(Option.getOrThrow(result)).toBe("/tools/node/20.0.0");
			}),
		);
	});

	describe("download", () => {
		it.effect("records the download call and returns a path", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.download("https://example.com/tool.tar.gz")),
				);

				expect(result).toContain("tool.tar.gz");
				expect(state.downloadCalls).toHaveLength(1);
				expect(state.downloadCalls[0]).toEqual({ url: "https://example.com/tool.tar.gz" });
			}),
		);
	});

	describe("extractTar", () => {
		it.effect("records call and returns destination", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.extractTar("/tmp/archive.tar.gz", "/tmp/out")),
				);

				expect(result).toBe("/tmp/out");
				expect(state.extractTarCalls).toHaveLength(1);
				expect(state.extractTarCalls[0]).toEqual({ file: "/tmp/archive.tar.gz", dest: "/tmp/out" });
			}),
		);

		it.effect("generates a path when dest is omitted", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.extractTar("/tmp/archive.tar.gz")),
				);

				expect(result).toContain("archive.tar.gz");
				expect(state.extractTarCalls).toHaveLength(1);
			}),
		);
	});

	describe("extractZip", () => {
		it.effect("records call and returns destination", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.extractZip("/tmp/archive.zip", "/tmp/out")),
				);

				expect(result).toBe("/tmp/out");
				expect(state.extractZipCalls).toHaveLength(1);
				expect(state.extractZipCalls[0]).toEqual({ file: "/tmp/archive.zip", dest: "/tmp/out" });
			}),
		);
	});

	describe("cacheDir", () => {
		it.effect("records call and returns cached path", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.cacheDir("/tmp/extracted", "node", "20.0.0")),
				);

				expect(result).toBe("/tools/node/20.0.0");
				expect(state.cacheDirCalls).toHaveLength(1);
				expect(state.cacheDirCalls[0]).toEqual({ sourceDir: "/tmp/extracted", tool: "node", version: "20.0.0" });
			}),
		);

		it.effect("adds tool to cached tools", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.cacheDir("/tmp/extracted", "node", "20.0.0")),
				);

				expect(state.cachedTools.has("node@20.0.0")).toBe(true);
			}),
		);
	});

	describe("cacheFile", () => {
		it.effect("records call and returns cached path", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.cacheFile("/tmp/biome", "biome", "biome", "1.0.0")),
				);

				expect(result).toBe("/tools/biome/1.0.0");
				expect(state.cacheFileCalls).toHaveLength(1);
				expect(state.cacheFileCalls[0]).toEqual({
					sourceFile: "/tmp/biome",
					targetFile: "biome",
					tool: "biome",
					version: "1.0.0",
				});
			}),
		);

		it.effect("adds tool to cached tools", () =>
			Effect.gen(function* () {
				const state = ToolInstallerTest.empty();

				yield* run(
					state,
					Effect.flatMap(ToolInstaller, (svc) => svc.cacheFile("/tmp/biome", "biome", "biome", "1.0.0")),
				);

				expect(state.cachedTools.has("biome@1.0.0")).toBe(true);
			}),
		);
	});
});
