import { FileSystem } from "@effect/platform";
import type { Exit } from "effect";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ChangesetConfigError } from "../errors/ChangesetConfigError.js";
import { VersioningDetectionError } from "../errors/VersioningDetectionError.js";
import { ChangesetConfigReader, ChangesetConfigReaderLive } from "./ChangesetConfigReader.js";

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
	return ChangesetConfigReaderLive.pipe(Layer.provide(testFs));
}

function runWith<A, E>(files: Record<string, string>, effect: Effect.Effect<A, E, ChangesetConfigReader>): Promise<A> {
	const layer = makeLayer(files);
	return Effect.runPromise(Effect.provide(effect, layer));
}

function runExitWith<A, E>(
	files: Record<string, string>,
	effect: Effect.Effect<A, E, ChangesetConfigReader>,
): Promise<Exit.Exit<A, E>> {
	const layer = makeLayer(files);
	return Effect.runPromiseExit(Effect.provide(effect, layer));
}

const ROOT = "/project";
const CONFIG_PATH = `${ROOT}/.changeset/config.json`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangesetConfigReader", () => {
	describe("standard config", () => {
		it("reads standard config with baseBranch", async () => {
			const config = {
				baseBranch: "main",
				access: "public",
			};
			const files = { [CONFIG_PATH]: JSON.stringify(config) };

			const result = await runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

			expect(result.baseBranch).toBe("main");
			expect(result.access).toBe("public");
		});

		it("reads fixed groups from standard config", async () => {
			const config = {
				fixed: [["@scope/pkg-a", "@scope/pkg-b"]],
				baseBranch: "main",
			};
			const files = { [CONFIG_PATH]: JSON.stringify(config) };

			const result = await runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

			expect(result.fixed).toEqual([["@scope/pkg-a", "@scope/pkg-b"]]);
		});

		it("standard config does NOT have _isSilk", async () => {
			const config = {
				changelog: "@changesets/cli/changelog",
				baseBranch: "main",
			};
			const files = { [CONFIG_PATH]: JSON.stringify(config) };

			const result = await runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

			expect((result as { _isSilk?: boolean })._isSilk).toBeUndefined();
		});
	});

	describe("Silk config detection", () => {
		it("detects Silk config when changelog is string containing @savvy-web/changesets", async () => {
			const config = {
				changelog: "@savvy-web/changesets/changelog",
				baseBranch: "main",
			};
			const files = { [CONFIG_PATH]: JSON.stringify(config) };

			const result = await runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

			expect((result as { _isSilk?: boolean })._isSilk).toBe(true);
		});

		it("detects Silk config when changelog is array with @savvy-web/changesets as first element", async () => {
			const config = {
				changelog: ["@savvy-web/changesets/changelog", { repo: "savvy-web/systems" }],
				baseBranch: "main",
			};
			const files = { [CONFIG_PATH]: JSON.stringify(config) };

			const result = await runWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

			expect((result as { _isSilk?: boolean })._isSilk).toBe(true);
		});
	});

	describe("error cases", () => {
		it("fails with ChangesetConfigError when file is missing", async () => {
			const files: Record<string, string> = {};

			const exit = await runExitWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				const cause = exit.cause;
				// Check cause is a Fail
				expect(cause._tag).toBe("Fail");
				if (cause._tag === "Fail") {
					const error = cause.error;
					expect((error as { _tag: string })._tag).toBe("ChangesetConfigError");
					expect((error as { path: string }).path).toContain(".changeset/config.json");
				}
			}
		});

		it("fails with ChangesetConfigError when JSON is invalid", async () => {
			const files = { [CONFIG_PATH]: "not valid json {{{" };

			const exit = await runExitWith(files, ChangesetConfigReader.pipe(Effect.andThen((reader) => reader.read(ROOT))));

			expect(exit._tag).toBe("Failure");
		});
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

describe("VersioningDetectionError", () => {
	it("has correct _tag", () => {
		const err = new VersioningDetectionError({ reason: "no packages found" });
		expect(err._tag).toBe("VersioningDetectionError");
	});

	it("includes reason in message", () => {
		const err = new VersioningDetectionError({ reason: "no packages found" });
		expect(err.message).toContain("no packages found");
	});
});
