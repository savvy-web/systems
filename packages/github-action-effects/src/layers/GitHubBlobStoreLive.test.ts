import { HttpClient, HttpClientError, HttpClientResponse } from "@effect/platform";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlobStore } from "../services/BlobStore.js";
import { GitHubBlobStoreLive } from "./GitHubBlobStoreLive.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUploadData = vi.fn().mockResolvedValue(undefined);
const mockDownloadToBuffer = vi.fn().mockResolvedValue(Buffer.from([1, 2, 3]));

vi.mock("@azure/storage-blob", () => ({
	BlockBlobClient: class MockBlockBlobClient {
		uploadData = mockUploadData;
		constructor(public url: string) {}
	},
	BlobClient: class MockBlobClient {
		downloadToBuffer = mockDownloadToBuffer;
		constructor(public url: string) {}
	},
}));

// ---------------------------------------------------------------------------
// HttpClient mock (mirrors ActionCacheLive.test.ts)
// ---------------------------------------------------------------------------

interface TwirpReply {
	readonly status: number;
	readonly body?: unknown;
	readonly transportError?: string;
}

interface CapturedTwirp {
	readonly url: string;
	readonly body: unknown;
	readonly headers: Record<string, string>;
}

let twirpReplies: Array<TwirpReply> = [];
let twirpCaptured: Array<CapturedTwirp> = [];

const mockHttpLayer: Layer.Layer<HttpClient.HttpClient> = Layer.succeed(
	HttpClient.HttpClient,
	HttpClient.make((request, url) =>
		Effect.gen(function* () {
			const headers: Record<string, string> = {};
			for (const [k, v] of Object.entries(request.headers)) {
				if (typeof v === "string") headers[k.toLowerCase()] = v;
			}
			const bodyText = yield* Effect.promise(async () => {
				const b = request.body as { body?: unknown };
				if (b && typeof b === "object" && "body" in b && b.body instanceof Uint8Array) {
					return new TextDecoder().decode(b.body);
				}
				return "";
			});
			const parsedBody = bodyText ? JSON.parse(bodyText) : undefined;
			twirpCaptured.push({ url: url.toString(), body: parsedBody, headers });

			const reply = twirpReplies.shift() ?? { status: 500 };
			if (reply.transportError !== undefined) {
				return yield* Effect.fail(
					new HttpClientError.RequestError({
						request,
						reason: "Transport",
						cause: new Error(reply.transportError),
						description: reply.transportError,
					}),
				);
			}
			const noBody = reply.status === 204 || reply.status === 304;
			return HttpClientResponse.fromWeb(
				request,
				new Response(noBody ? null : JSON.stringify(reply.body ?? null), {
					status: reply.status,
					headers: { "content-type": "application/json" },
				}),
			);
		}),
	),
);

const liveLayer = GitHubBlobStoreLive.pipe(Layer.provide(mockHttpLayer));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const queueReplies = (...replies: Array<TwirpReply>): void => {
	twirpReplies.push(...replies);
};

beforeEach(() => {
	twirpReplies = [];
	twirpCaptured = [];
});

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	// Clear any env stubs a test set so a test that throws before its own unstub cannot leak
	// ACTIONS_RESULTS_URL / ACTIONS_RUNTIME_TOKEN into the next test.
	vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GitHubBlobStoreLive", () => {
	it("put issues CreateCacheEntry + FinalizeCacheEntryUpload for the key", async () => {
		vi.stubEnv("ACTIONS_RESULTS_URL", "https://results.example.com/");
		vi.stubEnv("ACTIONS_RUNTIME_TOKEN", "test-token");

		queueReplies(
			{ status: 200, body: { ok: true, signed_upload_url: "https://azure.example.com/upload" } },
			{ status: 200, body: { ok: true, entry_id: "entry-1" } },
		);

		const program = Effect.flatMap(BlobStore, (s) => s.put("h1", new Uint8Array([9])));
		await Effect.runPromise(program.pipe(Effect.provide(liveLayer)));

		expect(twirpCaptured).toHaveLength(2);
		expect(twirpCaptured[0]?.url).toContain("twirp/github.actions.results.api.v1.CacheService/CreateCacheEntry");
		expect(twirpCaptured[1]?.url).toContain(
			"twirp/github.actions.results.api.v1.CacheService/FinalizeCacheEntryUpload",
		);
		expect(twirpCaptured[0]?.body).toMatchObject({ key: "h1" });

		vi.unstubAllEnvs();
	});

	it("get returns none on cache miss (ok:false)", async () => {
		vi.stubEnv("ACTIONS_RESULTS_URL", "https://results.example.com/");
		vi.stubEnv("ACTIONS_RUNTIME_TOKEN", "test-token");

		queueReplies({ status: 200, body: { ok: false } });

		const program = Effect.flatMap(BlobStore, (s) => s.get("missing-key"));
		const result = await Effect.runPromise(program.pipe(Effect.provide(liveLayer)));

		expect(Option.isNone(result)).toBe(true);

		vi.unstubAllEnvs();
	});

	it("fails with BlobStoreError when env vars are missing", async () => {
		// Force the vars absent regardless of the ambient environment (these can be set on a
		// real Actions runner); afterEach's unstubAllEnvs restores them.
		vi.stubEnv("ACTIONS_RESULTS_URL", undefined);
		vi.stubEnv("ACTIONS_RUNTIME_TOKEN", undefined);
		const program = Effect.flatMap(BlobStore, (s) => s.put("k", new Uint8Array([1])));
		const exit = await Effect.runPromise(Effect.exit(program.pipe(Effect.provide(liveLayer))));
		expect(Exit.isFailure(exit)).toBe(true);
		const error = Exit.isFailure(exit) ? Option.getOrUndefined(Cause.failureOption(exit.cause)) : undefined;
		expect(error?._tag).toBe("BlobStoreError");
		expect(error?.reason).toContain("ACTIONS_RESULTS_URL");
	});
});
