import { HttpClient, HttpClientResponse } from "@effect/platform";
import { Effect, Layer, Option, Redacted } from "effect";
import { describe, expect, it } from "vitest";
import { BlobStore } from "../services/BlobStore.js";
import { S3BlobStoreLive } from "./S3BlobStoreLive.js";

const config = {
	bucket: "b",
	region: "us-east-1",
	accessKeyId: "AK",
	secretAccessKey: Redacted.make("SK"),
	prefix: "turbo/",
};

describe("S3BlobStoreLive", () => {
	it("put issues a signed PUT to the path-style object URL", async () => {
		const calls: Array<{ method: string; url: string; auth: string | undefined }> = [];
		const mockHttp = Layer.succeed(
			HttpClient.HttpClient,
			HttpClient.make((req, url) =>
				Effect.sync(() => {
					calls.push({ method: req.method, url: url.toString(), auth: req.headers.authorization });
					return HttpClientResponse.fromWeb(req, new Response(null, { status: 200 }));
				}),
			),
		);
		const program = Effect.gen(function* () {
			const s = yield* BlobStore;
			yield* s.put("hash1", new Uint8Array([1, 2, 3]));
		});
		await Effect.runPromise(program.pipe(Effect.provide(S3BlobStoreLive(config)), Effect.provide(mockHttp)));
		expect(calls[0]?.method).toBe("PUT");
		expect(calls[0]?.url).toBe("https://s3.us-east-1.amazonaws.com/b/turbo/hash1");
		expect(calls[0]?.auth).toMatch(/^AWS4-HMAC-SHA256 /);
	});

	it("get returns none on 404", async () => {
		const mockHttp = Layer.succeed(
			HttpClient.HttpClient,
			HttpClient.make((req) => Effect.succeed(HttpClientResponse.fromWeb(req, new Response(null, { status: 404 })))),
		);
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const s = yield* BlobStore;
				return yield* s.get("missing");
			}).pipe(Effect.provide(S3BlobStoreLive(config)), Effect.provide(mockHttp)),
		);
		expect(Option.isNone(result)).toBe(true);
	});

	it("has returns false on 404", async () => {
		const mockHttp = Layer.succeed(
			HttpClient.HttpClient,
			HttpClient.make((req) => Effect.succeed(HttpClientResponse.fromWeb(req, new Response(null, { status: 404 })))),
		);
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const s = yield* BlobStore;
				return yield* s.has("missing");
			}).pipe(Effect.provide(S3BlobStoreLive(config)), Effect.provide(mockHttp)),
		);
		expect(result).toBe(false);
	});

	it("has fails (not false) on a 5xx server error", async () => {
		const mockHttp = Layer.succeed(
			HttpClient.HttpClient,
			HttpClient.make((req) => Effect.succeed(HttpClientResponse.fromWeb(req, new Response(null, { status: 503 })))),
		);
		const exit = await Effect.runPromise(
			Effect.gen(function* () {
				const s = yield* BlobStore;
				return yield* s.has("key");
			}).pipe(Effect.provide(S3BlobStoreLive(config)), Effect.provide(mockHttp), Effect.exit),
		);
		expect(exit._tag).toBe("Failure");
	});
});
