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
	// Copy on store and on read so a caller mutating its buffer cannot reach into store state
	// (and vice versa) — the live backends serialize over the wire, so they are copy-like.
	put: (key, bytes) =>
		Effect.sync(() => {
			state.entries.set(key, new Uint8Array(bytes));
		}),
	get: (key) =>
		Effect.sync(
			(): Option.Option<Uint8Array> =>
				Option.fromNullishOr(state.entries.get(key)).pipe(Option.map((bytes) => new Uint8Array(bytes))),
		),
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
