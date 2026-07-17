import type { Effect, Option } from "effect";
import { Context } from "effect";
import type { BlobStoreError } from "../errors/BlobStoreError.js";

/**
 * Service shape for {@link BlobStore}.
 *
 * @public
 */
export interface BlobStoreShape {
	/** Fetch the bytes stored under `key`, or `Option.none()` on miss. */
	readonly get: (key: string) => Effect.Effect<Option.Option<Uint8Array>, BlobStoreError>;
	/** Store `bytes` under `key`, overwriting any existing value. */
	readonly put: (key: string, bytes: Uint8Array) => Effect.Effect<void, BlobStoreError>;
	/** Report whether `key` exists without downloading its bytes. */
	readonly has: (key: string) => Effect.Effect<boolean, BlobStoreError>;
}

/**
 * A generic content-addressable key/value blob store.
 *
 * Backends store raw bytes under an arbitrary string key. Unlike
 * {@link ActionCache} (which tars a path-set under one key), this stores a
 * single byte buffer per key, suitable for per-artifact remote caching.
 *
 * @public
 */
export class BlobStore extends Context.Service<BlobStore, BlobStoreShape>()("github-action-effects/BlobStore") {}
