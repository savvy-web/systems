import { createHash } from "node:crypto";
import { Effect, Layer, Option, Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { BlobStoreError } from "../errors/BlobStoreError.js";
import { BlobStore } from "../services/BlobStore.js";
import { signS3Request } from "./internal/sigv4.js";

/**
 * Configuration for an S3-backed {@link BlobStore}. Secret material is held as
 * `Redacted` so it cannot be accidentally logged; it is unwrapped only
 * inside the request signer.
 * @public
 */
export interface S3BlobStoreConfig {
	readonly bucket: string;
	readonly region: string;
	readonly endpoint?: string;
	readonly accessKeyId: string;
	readonly secretAccessKey: Redacted.Redacted<string>;
	readonly sessionToken?: Redacted.Redacted<string>;
	readonly prefix?: string;
}

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const sha256Hex = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");

/**
 * An S3-backed {@link BlobStore} using path-style addressing and SigV4.
 * Works with AWS S3 and S3-compatible stores (R2, MinIO, Spaces) via `endpoint`.
 * @public
 */
export const S3BlobStoreLive = (config: S3BlobStoreConfig): Layer.Layer<BlobStore, never, HttpClient.HttpClient> =>
	Layer.effect(
		BlobStore,
		Effect.gen(function* () {
			const http = yield* HttpClient.HttpClient;
			const fullKey = (key: string) => `${config.prefix ?? ""}${key}`;
			const sign = (method: "GET" | "PUT" | "HEAD", key: string, payloadHash: string) =>
				signS3Request({
					method,
					bucket: config.bucket,
					region: config.region,
					accessKeyId: config.accessKeyId,
					secretAccessKey: Redacted.value(config.secretAccessKey),
					key: fullKey(key),
					payloadHash,
					...(config.endpoint ? { endpoint: config.endpoint } : {}),
					...(config.sessionToken ? { sessionToken: Redacted.value(config.sessionToken) } : {}),
				});

			return {
				put: (key, bytes) =>
					Effect.gen(function* () {
						const { url, headers } = sign("PUT", key, sha256Hex(bytes));
						const req = HttpClientRequest.put(url).pipe(
							HttpClientRequest.setHeaders(headers),
							HttpClientRequest.bodyUint8Array(bytes),
						);
						const res = yield* http.execute(req);
						if (res.status >= 300) {
							return yield* Effect.fail(
								new BlobStoreError({ key, operation: "put", reason: `S3 PUT returned ${res.status}` }),
							);
						}
					}).pipe(
						Effect.catch((e) =>
							e instanceof BlobStoreError
								? Effect.fail(e)
								: Effect.fail(new BlobStoreError({ key, operation: "put", reason: String(e) })),
						),
					),

				get: (key) =>
					Effect.gen(function* () {
						const { url, headers } = sign("GET", key, EMPTY_SHA256);
						const req = HttpClientRequest.get(url).pipe(HttpClientRequest.setHeaders(headers));
						const res = yield* http.execute(req);
						if (res.status === 404) return Option.none<Uint8Array>();
						if (res.status >= 300) {
							return yield* Effect.fail(
								new BlobStoreError({ key, operation: "get", reason: `S3 GET returned ${res.status}` }),
							);
						}
						const buf = yield* res.arrayBuffer;
						return Option.some(new Uint8Array(buf));
					}).pipe(
						Effect.catch((e) =>
							e instanceof BlobStoreError
								? Effect.fail(e)
								: Effect.fail(new BlobStoreError({ key, operation: "get", reason: String(e) })),
						),
					),

				has: (key) =>
					Effect.gen(function* () {
						const { url, headers } = sign("HEAD", key, EMPTY_SHA256);
						const req = HttpClientRequest.head(url).pipe(HttpClientRequest.setHeaders(headers));
						const res = yield* http.execute(req);
						if (res.status === 404) return false;
						if (res.status >= 300) {
							return yield* Effect.fail(
								new BlobStoreError({ key, operation: "has", reason: `S3 HEAD returned ${res.status}` }),
							);
						}
						return true;
					}).pipe(
						Effect.catch((e) =>
							e instanceof BlobStoreError
								? Effect.fail(e)
								: Effect.fail(new BlobStoreError({ key, operation: "has", reason: String(e) })),
						),
					),
			};
		}),
	);
