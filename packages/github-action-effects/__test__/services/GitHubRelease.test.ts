import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { GitHubReleaseTest } from "../../src/layers/GitHubReleaseTest.js";
import { GitHubRelease } from "../../src/services/GitHubRelease.js";

describe("GitHubRelease", () => {
	it.effect("creates a release", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubReleaseTest.empty();
			const result = yield* GitHubRelease.pipe(
				Effect.flatMap((svc) => svc.create({ tag: "v1.0.0", name: "Release 1.0.0", body: "Changes" })),
				Effect.provide(layer),
			);
			expect(result.tag).toBe("v1.0.0");
			expect(result.id).toBe(1);
			expect(state.createCalls).toHaveLength(1);
		}),
	);

	it.effect("uploads an asset", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubReleaseTest.empty();
			const result = yield* GitHubRelease.pipe(
				Effect.flatMap((svc) => svc.uploadAsset(1, "dist.tar.gz", "data", "application/gzip")),
				Effect.provide(layer),
			);
			expect(result.name).toBe("dist.tar.gz");
			expect(state.uploadCalls).toHaveLength(1);
		}),
	);

	it.effect("gets release by tag", () =>
		Effect.gen(function* () {
			const { layer } = GitHubReleaseTest.empty();
			const result = yield* GitHubRelease.pipe(
				Effect.flatMap((svc) =>
					Effect.flatMap(svc.create({ tag: "v2.0.0", name: "Release 2.0.0", body: "Notes" }), () =>
						svc.getByTag("v2.0.0"),
					),
				),
				Effect.provide(layer),
			);
			expect(result.tag).toBe("v2.0.0");
		}),
	);

	it.effect("fails for unknown tag", () =>
		Effect.gen(function* () {
			const { layer } = GitHubReleaseTest.empty();
			const exit = yield* Effect.exit(
				GitHubRelease.pipe(
					Effect.flatMap((svc) => svc.getByTag("v99.0.0")),
					Effect.provide(layer),
				),
			);
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("lists releases", () =>
		Effect.gen(function* () {
			const { layer } = GitHubReleaseTest.empty();
			const result = yield* GitHubRelease.pipe(
				Effect.flatMap((svc) =>
					Effect.flatMap(svc.create({ tag: "v1.0.0", name: "R1", body: "" }), () =>
						Effect.flatMap(svc.create({ tag: "v2.0.0", name: "R2", body: "" }), () => svc.list()),
					),
				),
				Effect.provide(layer),
			);
			expect(result).toHaveLength(2);
		}),
	);

	it.effect("reports errors with operation and tag", () =>
		Effect.gen(function* () {
			const { layer } = GitHubReleaseTest.empty();
			const error = yield* GitHubRelease.pipe(
				Effect.flatMap((svc) => svc.getByTag("missing")),
				Effect.catch((e) => Effect.succeed(e)),
				Effect.provide(layer),
			);
			expect(error).toHaveProperty("operation", "getByTag");
			expect(error).toHaveProperty("tag", "missing");
		}),
	);
});
