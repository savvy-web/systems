import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Redacted } from "effect";
import { PackagePublishTest } from "../../src/layers/PackagePublishTest.js";
import { PackagePublish } from "../../src/services/PackagePublish.js";

describe("PackagePublish", () => {
	it.effect("setupAuth records registry and token", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.empty();
			yield* PackagePublish.pipe(
				Effect.flatMap((svc) => svc.setupAuth("npm.pkg.github.com", Redacted.make("ghp_abc123"))),
				Effect.provide(layer),
			);
			expect(state.setupAuthCalls).toHaveLength(1);
			expect(state.setupAuthCalls[0]?.registry).toBe("npm.pkg.github.com");
			expect(Redacted.value(state.setupAuthCalls[0]?.token as Redacted.Redacted<string>)).toBe("ghp_abc123");
		}),
	);

	it.effect("pack returns tarballPath, digest, and pack metadata", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.layer({
				packResult: {
					tarballPath: "/path/to/pkg/my-pkg-2.0.0.tgz",
					digest: "sha512-def456",
					sha256Hex: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
					name: "my-pkg",
					version: "2.0.0",
					packedSize: 1234,
					unpackedSize: 5678,
					fileCount: 9,
				},
			});
			const result = yield* PackagePublish.pipe(
				Effect.flatMap((svc) => svc.pack("/path/to/pkg")),
				Effect.provide(layer),
			);
			expect(result).toEqual({
				tarballPath: "/path/to/pkg/my-pkg-2.0.0.tgz",
				digest: "sha512-def456",
				sha256Hex: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
				name: "my-pkg",
				version: "2.0.0",
				packedSize: 1234,
				unpackedSize: 5678,
				fileCount: 9,
			});
			expect(state.packCalls).toEqual([{ packageDir: "/path/to/pkg" }]);
		}),
	);

	it.effect("publish records options", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.empty();
			const options = { registry: "https://registry.npmjs.org", tag: "latest", access: "public" as const };
			yield* PackagePublish.pipe(
				Effect.flatMap((svc) => svc.publish("/path/to/pkg", options)),
				Effect.provide(layer),
			);
			expect(state.publishCalls).toEqual([{ packageDir: "/path/to/pkg", options }]);
		}),
	);

	it.effect("verifyIntegrity returns true when match", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.layer({ integrityMatch: true });
			const result = yield* PackagePublish.pipe(
				Effect.flatMap((svc) => svc.verifyIntegrity("my-pkg", "1.0.0", "sha256-abc")),
				Effect.provide(layer),
			);
			expect(result).toBe(true);
			expect(state.verifyIntegrityCalls).toEqual([
				{ packageName: "my-pkg", version: "1.0.0", expectedDigest: "sha256-abc" },
			]);
		}),
	);

	it.effect("verifyIntegrity returns false when mismatch", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.layer({ integrityMatch: false });
			const result = yield* PackagePublish.pipe(
				Effect.flatMap((svc) => svc.verifyIntegrity("my-pkg", "1.0.0", "sha256-wrong")),
				Effect.provide(layer),
			);
			expect(result).toBe(false);
			expect(state.verifyIntegrityCalls).toHaveLength(1);
		}),
	);

	it.effect("publishToRegistries calls per registry", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.empty();
			const registries = [
				{ registry: "https://registry.npmjs.org", token: Redacted.make("npm_abc") },
				{ registry: "https://npm.pkg.github.com", token: Redacted.make("ghp_def"), tag: "next" },
			];
			yield* PackagePublish.pipe(
				Effect.flatMap((svc) => svc.publishToRegistries("/path/to/pkg", registries)),
				Effect.provide(layer),
			);
			expect(state.publishToRegistriesCalls).toEqual([{ packageDir: "/path/to/pkg", registries }]);
		}),
	);

	it.effect("publishIdempotent publishes when the version is absent", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.layer({ publishedVersions: [] });
			const result = yield* PackagePublish.pipe(
				Effect.flatMap((svc) =>
					svc.publishIdempotent({
						packageDir: "/pkg",
						packageName: "my-pkg",
						version: "1.0.0",
						digest: "sha512-abc",
					}),
				),
				Effect.provide(layer),
			);
			expect(result).toEqual({ status: "published", packageName: "my-pkg", version: "1.0.0" });
			expect(state.publishIdempotentCalls).toHaveLength(1);
		}),
	);

	it.effect("publishIdempotent skips when an identical version is already published", () =>
		Effect.gen(function* () {
			const { layer } = PackagePublishTest.layer({ publishedVersions: ["1.0.0"], integrityMatch: true });
			const result = yield* PackagePublish.pipe(
				Effect.flatMap((svc) =>
					svc.publishIdempotent({
						packageDir: "/pkg",
						packageName: "my-pkg",
						version: "1.0.0",
						digest: "sha512-abc",
					}),
				),
				Effect.provide(layer),
			);
			expect(result).toEqual({
				status: "skipped",
				packageName: "my-pkg",
				version: "1.0.0",
				skipReason: "already-published-identical",
			});
		}),
	);

	it.effect("publishIdempotent fails on a content mismatch", () =>
		Effect.gen(function* () {
			const { layer } = PackagePublishTest.layer({ publishedVersions: ["1.0.0"], integrityMatch: false });
			const exit = yield* Effect.exit(
				PackagePublish.pipe(
					Effect.flatMap((svc) =>
						svc.publishIdempotent({
							packageDir: "/pkg",
							packageName: "my-pkg",
							version: "1.0.0",
							digest: "sha512-wrong",
						}),
					),
					Effect.provide(layer),
				),
			);
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("dryRun returns ok: true by default and records the call", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.empty();
			const result = yield* PackagePublish.pipe(
				Effect.flatMap((svc) => svc.dryRun("/path/to/pkg", { registry: "https://registry.npmjs.org" })),
				Effect.provide(layer),
			);
			expect(result.ok).toBe(true);
			expect(result.output).toBe("dry-run ok");
			expect(state.dryRunCalls).toEqual([
				{ packageDir: "/path/to/pkg", options: { registry: "https://registry.npmjs.org" } },
			]);
		}),
	);

	it.effect("dryRun returns ok: false when dryRunOk is false", () =>
		Effect.gen(function* () {
			const { state, layer } = PackagePublishTest.layer({ dryRunOk: false });
			const result = yield* PackagePublish.pipe(
				Effect.flatMap((svc) => svc.dryRun("/path/to/pkg")),
				Effect.provide(layer),
			);
			expect(result.ok).toBe(false);
			expect(result.output).toBe("dry-run failed");
			expect(state.dryRunCalls).toHaveLength(1);
			expect(state.dryRunCalls[0]?.packageDir).toBe("/path/to/pkg");
		}),
	);
});
