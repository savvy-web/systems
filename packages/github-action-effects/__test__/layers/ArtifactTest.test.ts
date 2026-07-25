import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { ArtifactTest } from "../../src/layers/ArtifactTest.js";
import { Artifact } from "../../src/services/Artifact.js";

const run = <A, E>(state: ReturnType<typeof ArtifactTest.empty>, effect: Effect.Effect<A, E, Artifact>) =>
	Effect.provide(effect, ArtifactTest.layer(state));

describe("ArtifactTest round-trip", () => {
	it.effect("upload then list returns the uploaded artifact", () =>
		Effect.gen(function* () {
			const state = ArtifactTest.empty();
			const result = yield* run(
				state,
				Effect.gen(function* () {
					const svc = yield* Artifact;
					yield* svc.uploadArtifact("dist", ["a.txt", "b.txt"], "/work");
					return yield* svc.listArtifacts();
				}),
			);
			expect(result).toHaveLength(1);
			expect(result[0]?.name).toBe("dist");
			expect(result[0]?.size).toBe(2);
			expect(state.uploaded.get("dist")).toEqual(["a.txt", "b.txt"]);
		}),
	);

	it.effect("upload then getArtifact(name) returns it; unknown name → none", () =>
		Effect.gen(function* () {
			const state = ArtifactTest.empty();
			const [hit, miss] = yield* run(
				state,
				Effect.gen(function* () {
					const svc = yield* Artifact;
					const { id } = yield* svc.uploadArtifact("dist", ["a.txt"], "/work");
					const found = yield* svc.getArtifact("dist");
					const notFound = yield* svc.getArtifact("nope");
					return [found, notFound, id] as const;
				}),
			);
			expect(Option.isSome(hit)).toBe(true);
			if (Option.isSome(hit)) expect(hit.value.name).toBe("dist");
			expect(Option.isNone(miss)).toBe(true);
		}),
	);

	it.effect("assigns incrementing ids across uploads", () =>
		Effect.gen(function* () {
			const state = ArtifactTest.empty();
			const ids = yield* run(
				state,
				Effect.gen(function* () {
					const svc = yield* Artifact;
					const a = yield* svc.uploadArtifact("one", ["x"], "/work");
					const b = yield* svc.uploadArtifact("two", ["y"], "/work");
					return [a.id, b.id] as const;
				}),
			);
			expect(ids[0]).toBe(1);
			expect(ids[1]).toBe(2);
		}),
	);

	it.effect("delete removes it from subsequent list", () =>
		Effect.gen(function* () {
			const state = ArtifactTest.empty();
			const [deleted, after] = yield* run(
				state,
				Effect.gen(function* () {
					const svc = yield* Artifact;
					const { id } = yield* svc.uploadArtifact("dist", ["a.txt"], "/work");
					const del = yield* svc.deleteArtifact("dist");
					const list = yield* svc.listArtifacts();
					return [del.id === id, list] as const;
				}),
			);
			expect(deleted).toBe(true);
			expect(after).toEqual([]);
		}),
	);

	it.effect("deleteArtifact fails for an unknown name", () =>
		Effect.gen(function* () {
			const state = ArtifactTest.empty();
			const exit = yield* Effect.exit(
				Effect.flatMap(Artifact, (svc) => svc.deleteArtifact("nope")).pipe(Effect.provide(ArtifactTest.layer(state))),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("downloadArtifact returns the requested path", () =>
		Effect.gen(function* () {
			const state = ArtifactTest.empty();
			const result = yield* run(
				state,
				Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7, { path: "/dest" })),
			);
			expect(result.downloadPath).toBe("/dest");
		}),
	);
});
