import { describe, expect, it } from "@effect/vitest";
import type { Exit } from "effect";
import { Cause, Effect, FileSystem, Layer, Option } from "effect";
import { ChangesetConfigError } from "../../src/errors/ChangesetConfigError.js";
import { ChangesetConfigReader } from "../../src/services/ChangesetConfigReader.js";

// ---------------------------------------------------------------------------
// Mock FileSystem
// ---------------------------------------------------------------------------

const makeTestFs = (files: Record<string, string>) =>
	Layer.succeed(FileSystem.FileSystem, {
		exists: (path: string) => Effect.succeed(path in files),
		readFileString: (path: string) =>
			path in files
				? Effect.succeed(files[path])
				: Effect.fail(new Error(`ENOENT: ${path}`) as unknown as Parameters<typeof Effect.fail>[0]),
	} as unknown as FileSystem.FileSystem);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLayer(files: Record<string, string>) {
	const testFs = makeTestFs(files);
	return ChangesetConfigReader.layer.pipe(Layer.provide(testFs));
}

// Per-test provide is REQUIRED in both helpers, not an unoptimised leftover: `makeLayer`
// builds the mocked filesystem from the per-test `files` record, so the layer genuinely
// varies test by test and cannot be hoisted into a suite-boundary `layer(...)` block.
function runWith<A, E>(
	files: Record<string, string>,
	effect: Effect.Effect<A, E, ChangesetConfigReader>,
): Effect.Effect<A, E> {
	const layer = makeLayer(files);
	return Effect.provide(effect, layer);
}

function runExitWith<A, E>(
	files: Record<string, string>,
	effect: Effect.Effect<A, E, ChangesetConfigReader>,
): Effect.Effect<Exit.Exit<A, E>> {
	const layer = makeLayer(files);
	return Effect.exit(Effect.provide(effect, layer));
}

const ROOT = "/project";
const CONFIG_PATH = `${ROOT}/.changeset/config.json`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangesetConfigReader", () => {
	describe("standard config", () => {
		it.effect("reads standard config with baseBranch", () =>
			Effect.gen(function* () {
				const config = {
					baseBranch: "main",
					access: "public",
				};
				const files = { [CONFIG_PATH]: JSON.stringify(config) };

				const result = yield* runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

				expect(result.baseBranch).toBe("main");
				expect(result.access).toBe("public");
			}),
		);

		it.effect("reads fixed groups from standard config", () =>
			Effect.gen(function* () {
				const config = {
					fixed: [["@scope/pkg-a", "@scope/pkg-b"]],
					baseBranch: "main",
				};
				const files = { [CONFIG_PATH]: JSON.stringify(config) };

				const result = yield* runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

				expect(result.fixed).toEqual([["@scope/pkg-a", "@scope/pkg-b"]]);
			}),
		);

		it.effect("standard config does NOT have _isSilk", () =>
			Effect.gen(function* () {
				const config = {
					changelog: "@changesets/cli/changelog",
					baseBranch: "main",
				};
				const files = { [CONFIG_PATH]: JSON.stringify(config) };

				const result = yield* runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

				expect((result as { _isSilk?: boolean })._isSilk).toBeUndefined();
			}),
		);
	});

	describe("Silk config detection", () => {
		it.effect("detects Silk config when changelog is string containing @savvy-web/changesets", () =>
			Effect.gen(function* () {
				const config = {
					changelog: "@savvy-web/changesets/changelog",
					baseBranch: "main",
				};
				const files = { [CONFIG_PATH]: JSON.stringify(config) };

				const result = yield* runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

				expect((result as { _isSilk?: boolean })._isSilk).toBe(true);
			}),
		);

		it.effect("detects Silk config when changelog is array with @savvy-web/changesets as first element", () =>
			Effect.gen(function* () {
				const config = {
					changelog: ["@savvy-web/changesets/changelog", { repo: "savvy-web/systems" }],
					baseBranch: "main",
				};
				const files = { [CONFIG_PATH]: JSON.stringify(config) };

				const result = yield* runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

				expect((result as { _isSilk?: boolean })._isSilk).toBe(true);
			}),
		);

		it.effect("detects Silk config for the consolidated @savvy-web/silk/changesets/changelog string adapter", () =>
			Effect.gen(function* () {
				const config = {
					changelog: "@savvy-web/silk/changesets/changelog",
					baseBranch: "main",
				};
				const files = { [CONFIG_PATH]: JSON.stringify(config) };

				const result = yield* runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

				expect((result as { _isSilk?: boolean })._isSilk).toBe(true);
			}),
		);

		it.effect(
			"detects Silk config when changelog array uses @savvy-web/silk/changesets/changelog as first element",
			() =>
				Effect.gen(function* () {
					const config = {
						changelog: ["@savvy-web/silk/changesets/changelog", { repo: "savvy-web/systems" }],
						baseBranch: "main",
					};
					const files = { [CONFIG_PATH]: JSON.stringify(config) };

					const result = yield* runWith(
						files,
						ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))),
					);

					expect((result as { _isSilk?: boolean })._isSilk).toBe(true);
				}),
		);

		it.effect("detects Silk config when changelog is the string @savvy-web/changelog", () =>
			Effect.gen(function* () {
				const config = {
					baseBranch: "main",
					changelog: "@savvy-web/changelog",
				};
				const files = { [CONFIG_PATH]: JSON.stringify(config) };

				const result = yield* runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

				expect((result as { _isSilk?: boolean })._isSilk).toBe(true);
			}),
		);

		it.effect("detects Silk config when changelog array uses @savvy-web/changelog as first element", () =>
			Effect.gen(function* () {
				const config = {
					changelog: ["@savvy-web/changelog", { repo: "savvy-web/systems" }],
					baseBranch: "main",
				};
				const files = { [CONFIG_PATH]: JSON.stringify(config) };

				const result = yield* runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

				expect((result as { _isSilk?: boolean })._isSilk).toBe(true);
			}),
		);
	});

	describe("error cases", () => {
		it.effect("fails with ChangesetConfigError when file is missing", () =>
			Effect.gen(function* () {
				const files: Record<string, string> = {};

				const exit = yield* runExitWith(
					files,
					ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))),
				);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					// v4 Cause is a collection of reasons; extract the typed error.
					const error = Option.getOrThrow(Cause.findErrorOption(exit.cause));
					expect((error as { _tag: string })._tag).toBe("ChangesetConfigError");
					expect((error as { path: string }).path).toContain(".changeset/config.json");
				}
			}),
		);

		it.effect("fails with ChangesetConfigError when JSON is invalid", () =>
			Effect.gen(function* () {
				const files = { [CONFIG_PATH]: "not valid json {{{" };

				const exit = yield* runExitWith(
					files,
					ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))),
				);

				expect(exit._tag).toBe("Failure");
			}),
		);
	});
});

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe("ChangesetConfigError", () => {
	it("has correct _tag", () => {
		const err = new ChangesetConfigError({ path: "/repo/.changeset/config.json", reason: "File not found" });
		expect(err._tag).toBe("ChangesetConfigError");
	});

	it("includes path and reason in message", () => {
		const err = new ChangesetConfigError({ path: "/repo/.changeset/config.json", reason: "File not found" });
		expect(err.message).toContain("/repo/.changeset/config.json");
		expect(err.message).toContain("File not found");
	});
});
