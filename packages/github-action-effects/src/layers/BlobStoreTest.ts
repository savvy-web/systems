import { Effect, Layer, Option } from "effect";
import { BlobStore } from "../services/BlobStore.js";

/**
 * In-memory blob store state for testing.
 * @public
 */
export interface BlobStoreTestState {
	readonly entries: Map<string, Uint8Array>;
}

const makeTestStore = (state: BlobStoreTestState): typeof BlobStore.Service => ({
	put: (key, bytes) =>
		Effect.sync(() => {
			state.entries.set(key, bytes);
		}),
	get: (key) => Effect.sync((): Option.Option<Uint8Array> => Option.fromNullable(state.entries.get(key))),
	has: (key) => Effect.sync(() => state.entries.has(key)),
});

/**
 * Test implementation for {@link BlobStore}.
 * @public
 */
export const BlobStoreTest = {
	/** Create a fresh empty test state container. */
	empty: (): BlobStoreTestState => ({ entries: new Map() }),
	/** Create a test layer from the given state. */
	layer: (state: BlobStoreTestState): Layer.Layer<BlobStore> => Layer.succeed(BlobStore, makeTestStore(state)),
} as const;
