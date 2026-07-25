import { Buffer } from "node:buffer";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { GitHubClientTestState, RestResponse } from "../../src/layers/GitHubClientTest.js";
import { GitHubClientTest } from "../../src/layers/GitHubClientTest.js";
import { GitHubContentLive } from "../../src/layers/GitHubContentLive.js";
import { GitHubContent } from "../../src/services/GitHubContent.js";

const clientState = (rest: Array<[string, RestResponse]>): GitHubClientTestState => ({
	restResponses: new Map(rest),
	paginateResponses: new Map(),
	graphqlResponses: new Map(),
	repo: { owner: "owner", repo: "repo" },
});

describe("GitHubContentLive", () => {
	it.effect("getFile decodes a base64 file to UTF-8 text", () =>
		Effect.gen(function* () {
			const text = JSON.stringify({ version: "1.2.3" });
			const result = yield* Effect.gen(function* () {
				const svc = yield* GitHubContent;
				return yield* svc.getFile("pkg/package.json", "base-sha");
			}).pipe(
				Effect.provide(GitHubContentLive),
				Effect.provide(
					GitHubClientTest.layer(
						clientState([
							[
								"repos.getContent",
								{ data: { type: "file", encoding: "base64", content: Buffer.from(text).toString("base64") } },
							],
						]),
					),
				),
			);
			expect(JSON.parse(result)).toEqual({ version: "1.2.3" });
		}),
	);

	it.effect("getFile fails when the path resolves to a directory", () =>
		Effect.gen(function* () {
			const result = yield* Effect.gen(function* () {
				const svc = yield* GitHubContent;
				return yield* svc.getFile("some/dir", "base-sha");
			}).pipe(
				Effect.provide(GitHubContentLive),
				Effect.provide(GitHubClientTest.layer(clientState([["repos.getContent", { data: [{ type: "file" }] }]]))),
				Effect.flip,
			);
			expect(result._tag).toBe("GitHubContentError");
			expect(result.operation).toBe("getFile");
			expect(result.path).toBe("some/dir");
		}),
	);

	it.effect("getFile fails when the path resolves to a submodule", () =>
		Effect.gen(function* () {
			const result = yield* Effect.gen(function* () {
				const svc = yield* GitHubContent;
				return yield* svc.getFile("some/submodule", "base-sha");
			}).pipe(
				Effect.provide(GitHubContentLive),
				Effect.provide(GitHubClientTest.layer(clientState([["repos.getContent", { data: { type: "submodule" } }]]))),
				Effect.flip,
			);
			expect(result._tag).toBe("GitHubContentError");
			expect(result.operation).toBe("getFile");
			expect(result.path).toBe("some/submodule");
		}),
	);

	it.effect("getFile fails when the content encoding is not base64", () =>
		Effect.gen(function* () {
			const result = yield* Effect.gen(function* () {
				const svc = yield* GitHubContent;
				return yield* svc.getFile("big-file.bin", "base-sha");
			}).pipe(
				Effect.provide(GitHubContentLive),
				Effect.provide(
					GitHubClientTest.layer(
						clientState([["repos.getContent", { data: { type: "file", encoding: "none", content: "" } }]]),
					),
				),
				Effect.flip,
			);
			expect(result._tag).toBe("GitHubContentError");
			expect(result.operation).toBe("getFile");
			expect(result.path).toBe("big-file.bin");
			expect(result.reason).toContain("none");
		}),
	);

	it.effect("getFile wraps a client error as GitHubContentError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.gen(function* () {
				const svc = yield* GitHubContent;
				return yield* svc.getFile("missing.json", "base-sha");
			}).pipe(Effect.provide(GitHubContentLive), Effect.provide(GitHubClientTest.layer(clientState([]))), Effect.flip);
			expect(result._tag).toBe("GitHubContentError");
			expect(result.operation).toBe("getFile");
			expect(result.path).toBe("missing.json");
		}),
	);
});
