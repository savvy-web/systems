import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { WorkspaceDetectorTest } from "../../src/layers/WorkspaceDetectorTest.js";
import { WorkspaceDetector } from "../../src/services/WorkspaceDetector.js";

describe("WorkspaceDetector", () => {
	it.effect("detect returns workspace info", () =>
		Effect.gen(function* () {
			const layer = WorkspaceDetectorTest.layer({
				info: { root: ".", type: "pnpm", patterns: ["packages/*"] },
				packages: [],
			});
			const result = yield* WorkspaceDetector.pipe(
				Effect.flatMap((wd) => wd.detect()),
				Effect.provide(layer),
			);
			expect(result.type).toBe("pnpm");
			expect(result.patterns).toEqual(["packages/*"]);
		}),
	);

	it.effect("detect returns single for non-monorepo", () =>
		Effect.gen(function* () {
			const layer = WorkspaceDetectorTest.empty();
			const result = yield* WorkspaceDetector.pipe(
				Effect.flatMap((wd) => wd.detect()),
				Effect.provide(layer),
			);
			expect(result.type).toBe("single");
		}),
	);

	it.effect("listPackages returns all packages", () =>
		Effect.gen(function* () {
			const layer = WorkspaceDetectorTest.layer({
				info: { root: ".", type: "pnpm", patterns: ["packages/*"] },
				packages: [
					{ name: "@scope/a", version: "1.0.0", path: "packages/a", private: false, dependencies: {} },
					{
						name: "@scope/b",
						version: "2.0.0",
						path: "packages/b",
						private: true,
						dependencies: { "@scope/a": "^1.0.0" },
					},
				],
			});
			const result = yield* WorkspaceDetector.pipe(
				Effect.flatMap((wd) => wd.listPackages()),
				Effect.provide(layer),
			);
			expect(result).toHaveLength(2);
			expect(result[0]?.name).toBe("@scope/a");
		}),
	);

	it.effect("getPackage finds by name", () =>
		Effect.gen(function* () {
			const layer = WorkspaceDetectorTest.layer({
				info: { root: ".", type: "npm", patterns: ["packages/*"] },
				packages: [{ name: "my-pkg", version: "1.0.0", path: "packages/my-pkg", private: false, dependencies: {} }],
			});
			const result = yield* WorkspaceDetector.pipe(
				Effect.flatMap((wd) => wd.getPackage("my-pkg")),
				Effect.provide(layer),
			);
			expect(result.name).toBe("my-pkg");
		}),
	);

	it.effect("getPackage finds by path", () =>
		Effect.gen(function* () {
			const layer = WorkspaceDetectorTest.layer({
				info: { root: ".", type: "npm", patterns: ["packages/*"] },
				packages: [{ name: "my-pkg", version: "1.0.0", path: "packages/my-pkg", private: false, dependencies: {} }],
			});
			const result = yield* WorkspaceDetector.pipe(
				Effect.flatMap((wd) => wd.getPackage("packages/my-pkg")),
				Effect.provide(layer),
			);
			expect(result.name).toBe("my-pkg");
		}),
	);

	it.effect("getPackage fails for unknown package", () =>
		Effect.gen(function* () {
			const layer = WorkspaceDetectorTest.empty();
			const exit = yield* Effect.exit(
				WorkspaceDetector.pipe(
					Effect.flatMap((wd) => wd.getPackage("nonexistent")),
					Effect.provide(layer),
				),
			);
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);
});
