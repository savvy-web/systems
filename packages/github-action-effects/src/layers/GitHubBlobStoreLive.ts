import { createHash } from "node:crypto";
import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import { HttpClient } from "@effect/platform";
import { Effect, Layer, Option, Redacted } from "effect";
import { BlobStoreError } from "../errors/BlobStoreError.js";
import { BlobStore } from "../services/BlobStore.js";
import { CONFLICT, makeTwirpRetrySchedule, twirpCall as twirpCallShared } from "./internal/twirp.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TWIRP_SERVICE = "github.actions.results.api.v1.CacheService";

/**
 * Version constant for the blob store — a SHA-256 of a fixed marker string.
 * This is intentionally NOT path-based (unlike ActionCacheLive) since the
 * blob store key is caller-supplied and already content-addressed.
 */
const BLOB_VERSION = createHash("sha256").update("blobstore|1.0").digest("hex");

// Retry config for Twirp RPC (mirrors ActionCacheLive).
const RETRY_SCHEDULE = makeTwirpRetrySchedule((error: BlobStoreError) => error.reason);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read cache protocol env vars. Uses ACTIONS_RESULTS_URL for V2.
 * Mirrors the identical helper in ActionCacheLive.ts, changing only the
 * error constructor to BlobStoreError.
 */
const getCacheEnv = (operation: "get" | "put" | "has", key: string) =>
	Effect.try({
		try: () => {
			const resultsUrl = process.env.ACTIONS_RESULTS_URL;
			const token = process.env.ACTIONS_RUNTIME_TOKEN;
			if (!resultsUrl || !token) {
				throw new Error(
					`Missing required env vars: ${[!resultsUrl && "ACTIONS_RESULTS_URL", !token && "ACTIONS_RUNTIME_TOKEN"].filter(Boolean).join(", ")}`,
				);
			}
			const baseUrl = resultsUrl.endsWith("/") ? resultsUrl : `${resultsUrl}/`;
			return { baseUrl, token: Redacted.make(token) };
		},
		catch: (error) =>
			new BlobStoreError({
				key,
				operation,
				reason: error instanceof Error ? error.message : String(error),
			}),
	});

/**
 * Make a Twirp RPC call against the cache service via the shared client.
 * Returns the {@link CONFLICT} sentinel on HTTP 409 instead of failing.
 * Mirrors the local twirpCall wrapper in ActionCacheLive.ts, changing only
 * the error constructor.
 */
const twirpCall = <T>(
	http: HttpClient.HttpClient,
	baseUrl: string,
	token: Redacted.Redacted<string>,
	method: string,
	body: Record<string, unknown>,
	operation: "get" | "put" | "has",
	key: string,
) =>
	twirpCallShared<T, BlobStoreError>(
		http,
		baseUrl,
		TWIRP_SERVICE,
		token,
		method,
		body,
		(reason) => new BlobStoreError({ key, operation, reason }),
	);

// ---------------------------------------------------------------------------
// Twirp response types
// ---------------------------------------------------------------------------

interface GetCacheEntryResponse {
	readonly ok: boolean;
	readonly signed_download_url?: string;
}

interface CreateCacheEntryResponse {
	readonly ok: boolean;
	readonly signed_upload_url?: string;
}

interface FinalizeCacheEntryResponse {
	readonly ok: boolean;
	readonly entry_id?: string;
}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

/**
 * Live implementation of {@link BlobStore} backed by the GitHub Actions V2
 * Twirp cache protocol and Azure Blob Storage.
 *
 * Unlike {@link ActionCacheLive} (which tars a path-set before uploading),
 * this layer uploads/downloads raw in-memory byte buffers — one key per blob.
 * The version hash is a constant (`BLOB_VERSION`) rather than being derived
 * from paths, so any caller-supplied key maps to a unique, reproducible slot.
 *
 * Requires `HttpClient.HttpClient` for the Twirp RPCs; `ActionsRuntime.Default`
 * / `Action.run` provides it via `FetchHttpClient.layer`. Manual-wiring
 * consumers must provide it themselves.
 *
 * @public
 */
export const GitHubBlobStoreLive: Layer.Layer<BlobStore, never, HttpClient.HttpClient> = Layer.effect(
	BlobStore,
	Effect.gen(function* () {
		const http = yield* HttpClient.HttpClient;
		return {
			put: (key, bytes) =>
				Effect.gen(function* () {
					const { baseUrl, token } = yield* getCacheEnv("put", key);

					// Step 1: Create cache entry
					const create = yield* twirpCall<CreateCacheEntryResponse>(
						http,
						baseUrl,
						token,
						"CreateCacheEntry",
						{ key, version: BLOB_VERSION },
						"put",
						key,
					).pipe(Effect.retry(RETRY_SCHEDULE));

					// HTTP 409 = blob already exists for this key — treat as success
					if (create === CONFLICT) {
						return;
					}

					if (!create.ok || !create.signed_upload_url) {
						return yield* Effect.fail(
							new BlobStoreError({
								key,
								operation: "put",
								reason: "CreateCacheEntry returned no upload URL",
							}),
						);
					}

					// Step 2: Upload buffer directly via Azure SDK (no tar)
					yield* Effect.tryPromise({
						try: () => new BlockBlobClient(create.signed_upload_url as string).uploadData(Buffer.from(bytes)),
						catch: (e) =>
							new BlobStoreError({
								key,
								operation: "put",
								reason: `blob upload failed: ${e instanceof Error ? e.message : String(e)}`,
							}),
					});

					// Step 3: Finalize cache entry
					const finalize = yield* twirpCall<FinalizeCacheEntryResponse>(
						http,
						baseUrl,
						token,
						"FinalizeCacheEntryUpload",
						{ key, version: BLOB_VERSION, size_bytes: String(bytes.byteLength) },
						"put",
						key,
					).pipe(Effect.retry(RETRY_SCHEDULE));

					if (finalize === CONFLICT || !finalize.ok) {
						return yield* Effect.fail(
							new BlobStoreError({
								key,
								operation: "put",
								reason: "FinalizeCacheEntryUpload did not confirm success",
							}),
						);
					}
				}),

			get: (key) =>
				Effect.gen(function* () {
					const { baseUrl, token } = yield* getCacheEnv("get", key);

					// Step 1: Look up download URL
					const lookup = yield* twirpCall<GetCacheEntryResponse>(
						http,
						baseUrl,
						token,
						"GetCacheEntryDownloadURL",
						{ key, restore_keys: [], version: BLOB_VERSION },
						"get",
						key,
					).pipe(Effect.retry(RETRY_SCHEDULE));

					// Miss: CONFLICT sentinel, ok:false, or no URL
					if (lookup === CONFLICT || !lookup.ok || !lookup.signed_download_url) {
						return Option.none<Uint8Array>();
					}

					// Step 2: Download buffer from Azure SDK (no tar extraction)
					const buf = yield* Effect.tryPromise({
						try: () => new BlobClient(lookup.signed_download_url as string).downloadToBuffer(),
						catch: (e) =>
							new BlobStoreError({
								key,
								operation: "get",
								reason: `blob download failed: ${e instanceof Error ? e.message : String(e)}`,
							}),
					});

					return Option.some(new Uint8Array(buf));
				}),

			has: (key) =>
				Effect.gen(function* () {
					const { baseUrl, token } = yield* getCacheEnv("has", key);

					// Check for a download URL without downloading
					const lookup = yield* twirpCall<GetCacheEntryResponse>(
						http,
						baseUrl,
						token,
						"GetCacheEntryDownloadURL",
						{ key, restore_keys: [], version: BLOB_VERSION },
						"has",
						key,
					).pipe(Effect.retry(RETRY_SCHEDULE));

					return lookup !== CONFLICT && Boolean(lookup.ok && lookup.signed_download_url);
				}),
		};
	}),
);
