import { afterAll, beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { GitHubAppError } from "../../src/errors/GitHubAppError.js";
import { GitHubAppLive } from "../../src/layers/GitHubAppLive.js";
import { GitHubApp } from "../../src/services/GitHubApp.js";
import { OctokitAuthApp } from "../../src/services/OctokitAuthApp.js";

const mockAuth = vi.fn();

const mockOctokitAuthAppLayer = Layer.succeed(OctokitAuthApp, {
	createAppAuth: vi.fn((..._args: Array<unknown>) => mockAuth),
});

interface MockReply {
	readonly status: number;
	readonly body: string;
	/** Optional `link` response header for pagination. */
	readonly link?: string;
}

/** Captured HTTP request as seen by the mock client. */
interface CapturedRequest {
	readonly method: string;
	readonly url: string;
	readonly headers: Record<string, string>;
}

let captured: Array<CapturedRequest> = [];
let replies: Array<MockReply> = [];

/**
 * Mock `HttpClient` that replays scripted `replies` in order, capturing every
 * request so tests can assert URLs and headers. Replaces the previous
 * `globalThis.fetch` monkeypatch.
 */
const mockHttpClientLayer: Layer.Layer<HttpClient.HttpClient> = Layer.succeed(
	HttpClient.HttpClient,
	HttpClient.make((request, url) =>
		Effect.sync(() => {
			const headers: Record<string, string> = {};
			for (const [k, v] of Object.entries(request.headers)) {
				if (typeof v === "string") headers[k.toLowerCase()] = v;
			}
			captured.push({ method: request.method, url: url.toString(), headers });
			const reply = replies.shift() ?? { status: 500, body: "{}" };
			const responseHeaders: Record<string, string> = { "content-type": "application/json" };
			if (reply.link !== undefined) responseHeaders.link = reply.link;
			// 204/304 responses must have a null body per the Fetch spec.
			const noBody = reply.status === 204 || reply.status === 304;
			return HttpClientResponse.fromWeb(
				request,
				new Response(noBody ? null : reply.body, { status: reply.status, headers: responseHeaders }),
			);
		}),
	),
);

const testLayer = GitHubAppLive.pipe(Layer.provide(Layer.merge(mockOctokitAuthAppLayer, mockHttpClientLayer)));

const run = <A, E>(effect: Effect.Effect<A, E, GitHubApp>) => Effect.provide(effect, testLayer);

const runExit = <A, E>(effect: Effect.Effect<A, E, GitHubApp>) => Effect.exit(Effect.provide(effect, testLayer));

const pk = Redacted.make("my-private-key");

/** Find a captured request whose URL matches a substring. */
const findRequest = (substr: string): CapturedRequest | undefined => captured.find((r) => r.url.includes(substr));

const savedGithubRepository = process.env.GITHUB_REPOSITORY;

beforeEach(() => {
	mockAuth.mockReset();
	captured = [];
	replies = [];
	delete process.env.GITHUB_REPOSITORY;
});

afterAll(() => {
	if (savedGithubRepository !== undefined) {
		process.env.GITHUB_REPOSITORY = savedGithubRepository;
	} else {
		delete process.env.GITHUB_REPOSITORY;
	}
});

describe("GitHubAppLive", () => {
	describe("generateToken", () => {
		it.effect("calls createAppAuth with correct params and returns a redacted token", () =>
			Effect.gen(function* () {
				mockAuth.mockResolvedValue({
					token: "ghs_generated",
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 999,
				});

				const result = yield* run(Effect.flatMap(GitHubApp, (svc) => svc.generateToken("app-42", pk, 999)));

				expect(Redacted.value(result.token)).toBe("ghs_generated");
				expect(result.expiresAt).toBe("2099-01-01T00:00:00Z");
				expect(result.installationId).toBe(999);
				expect(result.permissions).toEqual({});
				expect(mockAuth).toHaveBeenCalledWith({ type: "installation", installationId: 999 });
			}),
		);

		it.effect("never exposes the private key in error/log output (S2/S5)", () =>
			Effect.gen(function* () {
				// Force createAppAuth to throw — the error must not contain the key.
				mockAuth.mockRejectedValue(new Error("auth failed"));
				const secretKey = Redacted.make("super-secret-private-key");
				const exit = yield* runExit(Effect.flatMap(GitHubApp, (svc) => svc.generateToken("app-1", secretKey, 123)));
				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					const serialized = JSON.stringify(exit.cause);
					expect(serialized).not.toContain("super-secret-private-key");
				}
			}),
		);

		it.effect("auto-discovers installationId when not provided", () =>
			Effect.gen(function* () {
				process.env.GITHUB_REPOSITORY = "savvy-web/my-repo";
				mockAuth.mockResolvedValueOnce({ token: "jwt_app_token" });
				replies.push({
					status: 200,
					body: JSON.stringify([
						{ id: 111, account: { login: "other-org" } },
						{ id: 222, account: { login: "savvy-web" } },
					]),
				});
				mockAuth.mockResolvedValueOnce({
					token: "ghs_discovered",
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 222,
				});

				const result = yield* run(Effect.flatMap(GitHubApp, (svc) => svc.generateToken("app-42", pk)));

				expect(Redacted.value(result.token)).toBe("ghs_discovered");
				expect(result.installationId).toBe(222);
				expect(mockAuth).toHaveBeenCalledWith({ type: "app" });
				const listReq = findRequest("/app/installations");
				expect(listReq?.headers.authorization).toBe("Bearer jwt_app_token");
				expect(mockAuth).toHaveBeenCalledWith({ type: "installation", installationId: 222 });
			}),
		);

		it.effect("follows the installations Link-header pagination", () =>
			Effect.gen(function* () {
				process.env.GITHUB_REPOSITORY = "target-org/my-repo";
				mockAuth.mockResolvedValueOnce({ token: "jwt_paginated" });
				// Page 1 with a Link header pointing to page 2.
				replies.push({
					status: 200,
					body: JSON.stringify([{ id: 1, account: { login: "org-a" } }]),
					link: '<https://api.github.com/app/installations?per_page=100&page=2>; rel="next"',
				});
				// Page 2 carries the target installation, no next link.
				replies.push({
					status: 200,
					body: JSON.stringify([{ id: 2, account: { login: "target-org" } }]),
				});
				mockAuth.mockResolvedValueOnce({
					token: "ghs_paginated",
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 2,
				});

				const result = yield* run(Effect.flatMap(GitHubApp, (svc) => svc.generateToken("app-1", pk)));

				expect(result.installationId).toBe(2);
				const listRequests = captured.filter((r) => r.url.includes("/app/installations"));
				expect(listRequests).toHaveLength(2);
				expect(listRequests[0]?.url).toBe("https://api.github.com/app/installations?per_page=100");
				expect(listRequests[1]?.url).toBe("https://api.github.com/app/installations?per_page=100&page=2");
				expect(listRequests[0]?.headers.authorization).toBe("Bearer jwt_paginated");
			}),
		);

		it.effect("falls back to first installation when GITHUB_REPOSITORY not set", () =>
			Effect.gen(function* () {
				mockAuth.mockResolvedValueOnce({ token: "jwt_token" });
				replies.push({ status: 200, body: JSON.stringify([{ id: 555, account: { login: "some-org" } }]) });
				mockAuth.mockResolvedValueOnce({
					token: "ghs_fallback",
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 555,
				});

				const result = yield* run(Effect.flatMap(GitHubApp, (svc) => svc.generateToken("app-1", pk)));

				expect(result.installationId).toBe(555);
				expect(mockAuth).toHaveBeenCalledWith({ type: "installation", installationId: 555 });
			}),
		);

		it.effect("errors when owner not found in installations", () =>
			Effect.gen(function* () {
				process.env.GITHUB_REPOSITORY = "missing-org/my-repo";
				mockAuth.mockResolvedValueOnce({ token: "jwt_token" });
				replies.push({ status: 200, body: JSON.stringify([{ id: 999, account: { login: "other-org" } }]) });

				const exit = yield* runExit(Effect.flatMap(GitHubApp, (svc) => svc.generateToken("app-1", pk)));
				expect(exit._tag).toBe("Failure");
			}),
		);

		it.effect("errors when no installations found", () =>
			Effect.gen(function* () {
				mockAuth.mockResolvedValueOnce({ token: "jwt_token" });
				replies.push({ status: 200, body: "[]" });

				const exit = yield* runExit(Effect.flatMap(GitHubApp, (svc) => svc.generateToken("app-1", pk)));
				expect(exit._tag).toBe("Failure");
			}),
		);

		it.effect("wraps errors as GitHubAppError", () =>
			Effect.gen(function* () {
				mockAuth.mockRejectedValue(new Error("auth failed"));
				const exit = yield* runExit(Effect.flatMap(GitHubApp, (svc) => svc.generateToken("app-1", pk, 123)));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("revokeToken", () => {
		it.effect("calls the GitHub API with DELETE and a token Authorization header", () =>
			Effect.gen(function* () {
				replies.push({ status: 204, body: "" });
				yield* run(Effect.flatMap(GitHubApp, (svc) => svc.revokeToken(Redacted.make("ghs_test"))));
				const req = findRequest("/installation/token");
				expect(req?.method).toBe("DELETE");
				expect(req?.headers.authorization).toBe("token ghs_test");
			}),
		);

		it.effect("wraps non-204 errors", () =>
			Effect.gen(function* () {
				replies.push({ status: 401, body: "{}" });
				const exit = yield* runExit(Effect.flatMap(GitHubApp, (svc) => svc.revokeToken(Redacted.make("ghs_bad"))));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("botIdentity", () => {
		it.effect("returns a verified identity when slug and user ID are present", () =>
			Effect.gen(function* () {
				const result = yield* run(
					Effect.map(GitHubApp, (svc) => svc.botIdentity({ appSlug: "acme-bot", appUserId: 123456 })),
				);
				expect(result).toEqual({
					name: "acme-bot[bot]",
					email: "123456+acme-bot[bot]@users.noreply.github.com",
				});
			}),
		);

		it.effect("falls back to github-actions[bot] when no source is given", () =>
			Effect.gen(function* () {
				const result = yield* run(Effect.map(GitHubApp, (svc) => svc.botIdentity()));
				expect(result).toEqual({
					name: "github-actions[bot]",
					email: "41898282+github-actions[bot]@users.noreply.github.com",
				});
			}),
		);
	});

	describe("resolveAppIdentity", () => {
		it.effect(
			"authenticates GET /app with the App JWT but leaves GET /users unauthenticated when no installation token is given",
			() =>
				Effect.gen(function* () {
					mockAuth.mockResolvedValueOnce({ token: "jwt_for_app" });
					replies.push({ status: 200, body: JSON.stringify({ slug: "acme-bot", name: "Acme Bot" }) });
					replies.push({ status: 200, body: JSON.stringify({ id: 123456 }) });

					const result = yield* run(Effect.flatMap(GitHubApp, (svc) => svc.resolveAppIdentity("app-1", pk)));

					expect(result).toEqual({ appSlug: "acme-bot", appUserId: 123456, appName: "Acme Bot" });
					expect(mockAuth).toHaveBeenCalledWith({ type: "app" });
					const appReq = findRequest("https://api.github.com/app");
					expect(appReq?.headers.authorization).toBe("Bearer jwt_for_app");
					const userReq = findRequest("/users/");
					expect(userReq?.url).toBe("https://api.github.com/users/acme-bot%5Bbot%5D");
					expect(userReq?.headers.authorization).toBeUndefined();
				}),
		);

		it.effect("authenticates GET /users with the installation token when one is provided", () =>
			Effect.gen(function* () {
				mockAuth.mockResolvedValueOnce({ token: "jwt_for_app" });
				replies.push({ status: 200, body: JSON.stringify({ slug: "acme-bot", name: "Acme Bot" }) });
				replies.push({ status: 200, body: JSON.stringify({ id: 123456 }) });

				const result = yield* run(
					Effect.flatMap(GitHubApp, (svc) =>
						svc.resolveAppIdentity("app-1", pk, Redacted.make("ghs_installation_token")),
					),
				);

				expect(result).toEqual({ appSlug: "acme-bot", appUserId: 123456, appName: "Acme Bot" });
				const userReq = findRequest("/users/");
				expect(userReq?.url).toBe("https://api.github.com/users/acme-bot%5Bbot%5D");
				expect(userReq?.headers.authorization).toBe("Bearer ghs_installation_token");
			}),
		);

		it.effect("skips the bot-user lookup and fails when GET /app returns no slug", () =>
			Effect.gen(function* () {
				mockAuth.mockResolvedValueOnce({ token: "jwt_for_app" });
				replies.push({ status: 200, body: JSON.stringify({ slug: "", name: "Acme Bot" }) });

				const exit = yield* runExit(Effect.flatMap(GitHubApp, (svc) => svc.resolveAppIdentity("app-1", pk)));

				expect(Exit.isFailure(exit)).toBe(true);
				// Only GET /app was attempted — no request to /users/<slug>[bot].
				expect(findRequest("/users/")).toBeUndefined();
			}),
		);

		it.effect("fails with GitHubAppError when GET /app errors", () =>
			Effect.gen(function* () {
				mockAuth.mockResolvedValueOnce({ token: "jwt_for_app" });
				replies.push({ status: 404, body: "{}" });

				const exit = yield* runExit(Effect.flatMap(GitHubApp, (svc) => svc.resolveAppIdentity("app-1", pk)));
				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					const error = Cause.findErrorOption(exit.cause);
					expect(error._tag).toBe("Some");
					if (error._tag === "Some") {
						expect(error.value).toBeInstanceOf(GitHubAppError);
						expect((error.value as GitHubAppError).operation).toBe("identity");
					}
				}
			}),
		);

		it.effect("fails with GitHubAppError naming the resolved bot login when GET /users errors", () =>
			Effect.gen(function* () {
				mockAuth.mockResolvedValueOnce({ token: "jwt_for_app" });
				replies.push({ status: 200, body: JSON.stringify({ slug: "acme-bot", name: "Acme Bot" }) });
				replies.push({ status: 404, body: "{}" });

				const exit = yield* runExit(Effect.flatMap(GitHubApp, (svc) => svc.resolveAppIdentity("app-1", pk)));
				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					const error = Cause.findErrorOption(exit.cause);
					expect(error._tag).toBe("Some");
					if (error._tag === "Some") {
						expect(error.value).toBeInstanceOf(GitHubAppError);
						expect((error.value as GitHubAppError).operation).toBe("identity");
						expect((error.value as GitHubAppError).reason).toContain("acme-bot[bot]");
						expect((error.value as GitHubAppError).reason).not.toContain("<slug>");
					}
				}
			}),
		);
	});

	describe("withToken", () => {
		it.effect("generates token, runs effect, and revokes", () =>
			Effect.gen(function* () {
				process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
				// Auto-discovery: JWT → installations list.
				mockAuth.mockResolvedValueOnce({ token: "jwt_for_discovery" });
				replies.push({ status: 200, body: JSON.stringify([{ id: 1, account: { login: "test-owner" } }]) });
				// Installation token.
				mockAuth.mockResolvedValueOnce({
					token: "ghs_bracket",
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 1,
				});
				// Revoke.
				replies.push({ status: 204, body: "" });

				const result = yield* run(
					Effect.flatMap(GitHubApp, (svc) =>
						svc.withToken("app-1", pk, (token) => Effect.succeed(`used:${Redacted.value(token)}`)),
					),
				);

				expect(result).toBe("used:ghs_bracket");
				expect(mockAuth).toHaveBeenCalledWith({ type: "app" });
				expect(mockAuth).toHaveBeenCalledWith({ type: "installation", installationId: 1 });
				expect(findRequest("/installation/token")?.method).toBe("DELETE");
			}),
		);

		it.effect("revokes even when effect fails", () =>
			Effect.gen(function* () {
				process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
				mockAuth.mockResolvedValueOnce({ token: "jwt_for_discovery" });
				replies.push({ status: 200, body: JSON.stringify([{ id: 1, account: { login: "test-owner" } }]) });
				mockAuth.mockResolvedValueOnce({
					token: "ghs_fail",
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 1,
				});
				replies.push({ status: 204, body: "" });

				const exit = yield* runExit(
					Effect.flatMap(GitHubApp, (svc) =>
						svc.withToken("app-1", pk, (_token) => Effect.fail(new Error("inner fail"))),
					),
				);

				expect(Exit.isFailure(exit)).toBe(true);
				expect(findRequest("/installation/token")?.method).toBe("DELETE");
			}),
		);
	});
});
