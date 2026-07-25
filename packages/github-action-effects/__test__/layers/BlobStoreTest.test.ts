import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { BlobStoreTest } from "../../src/layers/BlobStoreTest.js";
import { BlobStore } from "../../src/services/BlobStore.js";

describe("BlobStoreTest", () => {
	it.effect("round-trips put -> get -> has", () =>
		Effect.gen(function* () {
			const state = BlobStoreTest.empty();
			const program = Effect.gen(function* () {
				const store = yield* BlobStore;
				yield* store.put("abc", new Uint8Array([1, 2, 3]));
				const got = yield* store.get("abc");
				const present = yield* store.has("abc");
				const missing = yield* store.get("nope");
				return { got, present, missing };
			});
			const { got, present, missing } = yield* program.pipe(Effect.provide(BlobStoreTest.layer(state)));
			expect(Option.getOrNull(got)).toEqual(new Uint8Array([1, 2, 3]));
			expect(present).toBe(true);
			expect(Option.isNone(missing)).toBe(true);
		}),
	);
});
