import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Logger, Redacted } from "effect";
import { vi } from "vitest";
import { GitHubToken } from "../src/GitHubToken.js";
import { ActionOutputsTest } from "../src/layers/ActionOutputsTest.js";
import { ActionStateTest } from "../src/layers/ActionStateTest.js";
import type { GitHubAppTestState } from "../src/layers/GitHubAppTest.js";
import { GitHubAppTest } from "../src/layers/GitHubAppTest.js";
import { ActionState } from "../src/services/ActionState.js";
import type { BotIdentity, InstallationToken } from "../src/services/GitHubApp.js";
import { InstallationToken as InstallationTokenSchema } from "../src/services/GitHubApp.js";
import { GitHubClient } from "../src/services/GitHubClient.js";

const { octokitAuthCalls } = vi.hoisted(() => ({ octokitAuthCalls: [] as unknown[] }));
vi.mock("@octokit/rest", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@octokit/rest")>();
	class RecordingOctokit extends actual.Octokit {
		constructor(options?: ConstructorParameters<typeof actual.Octokit>[0]) {
			super(options);
			octokitAuthCalls.push(options?.auth);
		}
	}
	return { ...actual, Octokit: RecordingOctokit };
});

const STATE_KEY = "github-action-effects/installation-token";

/** Suppresses provision's INFO/WARN logging so test output stays clean. */
const silentLogger = Logger.layer([]);

/** Build a GitHubApp test state that returns the given installation token. */
const appStateWith = (
	token: InstallationToken,
	appIdentity?: { appSlug: string; appUserId: number; appName: string },
): GitHubAppTestState => ({
	generateCalls: [],
	revokeCalls: [],
	tokenToReturn: token,
	...(appIdentity !== undefined ? { appIdentity } : {}),
});

/** Provide GitHubApp + ActionState + ActionOutputs for a `provision` run. */
const provisionLayer = (
	state: ReturnType<typeof ActionStateTest.empty>,
	appState: GitHubAppTestState,
	outputs: ReturnType<typeof ActionOutputsTest.empty>,
) =>
	Layer.mergeAll(
		ActionStateTest.layer(state),
		GitHubAppTest.layer(appState),
		ActionOutputsTest.layer(outputs),
		silentLogger,
	);

beforeEach(() => {
	octokitAuthCalls.length = 0;
});

describe("GitHubToken", () => {
	describe("provision", () => {
		it.effect("generates a token with explicit credentials and persists it", () =>
			Effect.gen(function* () {
				const appState = appStateWith({
					token: Redacted.make("ghs_provisioned"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: { contents: "write" },
				});
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();

				const token = yield* Effect.provide(
					GitHubToken.provision({ clientId: "Iv1.abc", privateKey: "pk", installationId: 7 }),
					provisionLayer(state, appState, outputs),
				);

				expect(Redacted.value(token.token)).toBe("ghs_provisioned");
				expect(state.entries.has(STATE_KEY)).toBe(true);
				expect(appState.generateCalls).toHaveLength(1);
				expect(appState.generateCalls[0]?.appId).toBe("Iv1.abc");
				expect(appState.generateCalls[0]?.installationId).toBe(7);
			}),
		);

		it.effect("threads the redacted private key through provision without unwrapping early (S1)", () =>
			Effect.gen(function* () {
				const appState = appStateWith({
					token: Redacted.make("ghs_redacted"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: {},
				});
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();

				yield* Effect.provide(
					GitHubToken.provision({ clientId: "Iv1.abc", privateKey: Redacted.make("pk"), installationId: 7 }),
					provisionLayer(state, appState, outputs),
				);

				const passedKey = appState.generateCalls[0]?.privateKey;
				expect(passedKey).toBeDefined();
				expect(Redacted.isRedacted(passedKey)).toBe(true);
				expect(Redacted.value(passedKey as Redacted.Redacted<string>)).toBe("pk");
			}),
		);

		it.effect("masks the generated token via setSecret (S3 defense)", () =>
			Effect.gen(function* () {
				const appState = appStateWith({
					token: Redacted.make("ghs_secret"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: {},
				});
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();

				yield* Effect.provide(
					GitHubToken.provision({ clientId: "Iv1.abc", privateKey: "pk", installationId: 7 }),
					provisionLayer(state, appState, outputs),
				);

				expect(outputs.secrets).toContain("ghs_secret");
			}),
		);

		it.effect("persists the installation token as a Redacted field that round-trips through ActionState (S3)", () =>
			Effect.gen(function* () {
				const appState = appStateWith({
					token: Redacted.make("ghs_roundtrip"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: {},
				});
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();

				yield* Effect.provide(
					GitHubToken.provision({ clientId: "Iv1.abc", privateKey: "pk", installationId: 7 }),
					provisionLayer(state, appState, outputs),
				);

				// The encoded GITHUB_STATE line still contains the raw token bytes
				// (encode is transparent).
				const persisted = JSON.parse(state.entries.get(STATE_KEY) ?? "{}");
				expect(persisted.token).toBe("ghs_roundtrip");

				// Reading it back decodes the token into a Redacted wrapper.
				const readBack = yield* Effect.provide(GitHubToken.read(), ActionStateTest.layer(state));
				expect(Redacted.isRedacted(readBack.token)).toBe(true);
				expect(Redacted.value(readBack.token)).toBe("ghs_roundtrip");
			}),
		);

		it.effect("reads credentials from Config when none are passed", () =>
			Effect.gen(function* () {
				const appState = appStateWith({
					token: Redacted.make("ghs_from_config"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: {},
				});
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();
				const configProvider = ConfigProvider.fromUnknown({
					"app-client-id": "Iv1.config",
					"app-private-key": "config-pk",
				});

				const token = yield* Effect.provide(
					GitHubToken.provision({ installationId: 7 }).pipe(Effect.provide(ConfigProvider.layer(configProvider))),
					provisionLayer(state, appState, outputs),
				);

				expect(Redacted.value(token.token)).toBe("ghs_from_config");
				expect(appState.generateCalls[0]?.appId).toBe("Iv1.config");
				expect(Redacted.value(appState.generateCalls[0]?.privateKey as Redacted.Redacted<string>)).toBe("config-pk");
			}),
		);

		it.effect("passes the permission check when scopes are sufficient", () =>
			Effect.gen(function* () {
				const appState = appStateWith({
					token: Redacted.make("ghs_ok"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: { contents: "write" },
				});
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();

				const token = yield* Effect.provide(
					GitHubToken.provision({
						clientId: "Iv1.abc",
						privateKey: "pk",
						installationId: 7,
						permissions: { contents: "write" },
					}),
					provisionLayer(state, appState, outputs),
				);

				expect(Redacted.value(token.token)).toBe("ghs_ok");
			}),
		);

		it.effect("revokes the generated token and fails when a required scope is missing", () =>
			Effect.gen(function* () {
				const appState = appStateWith({
					token: Redacted.make("ghs_weak"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: { contents: "read" },
				});
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();

				const exit = yield* Effect.exit(
					Effect.provide(
						GitHubToken.provision({
							clientId: "Iv1.abc",
							privateKey: "pk",
							installationId: 7,
							permissions: { contents: "write" },
						}),
						provisionLayer(state, appState, outputs),
					),
				);

				expect(exit._tag).toBe("Failure");
				expect(state.entries.has(STATE_KEY)).toBe(false);
				expect(appState.revokeCalls.map((t) => Redacted.value(t))).toContain("ghs_weak");
			}),
		);

		it.effect("resolves and persists the App identity", () =>
			Effect.gen(function* () {
				const appState = appStateWith(
					{
						token: Redacted.make("ghs_with_identity"),
						expiresAt: "2099-01-01T00:00:00Z",
						installationId: 7,
						permissions: {},
					},
					{ appSlug: "acme-bot", appUserId: 123456, appName: "Acme Bot" },
				);
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();

				const token = yield* Effect.provide(
					GitHubToken.provision({ clientId: "Iv1.abc", privateKey: "pk", installationId: 7 }),
					provisionLayer(state, appState, outputs),
				);

				expect(token.appSlug).toBe("acme-bot");
				expect(token.appUserId).toBe(123456);
				expect(token.appName).toBe("Acme Bot");

				const persisted = JSON.parse(state.entries.get(STATE_KEY) ?? "{}");
				expect(persisted.appSlug).toBe("acme-bot");
				expect(persisted.appUserId).toBe(123456);
			}),
		);

		it.effect("persists the token without identity when resolution fails", () =>
			Effect.gen(function* () {
				const appState = appStateWith({
					token: Redacted.make("ghs_no_identity"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: {},
				});
				const state = ActionStateTest.empty();
				const outputs = ActionOutputsTest.empty();

				const token = yield* Effect.provide(
					GitHubToken.provision({ clientId: "Iv1.abc", privateKey: "pk", installationId: 7 }),
					provisionLayer(state, appState, outputs),
				);

				expect(Redacted.value(token.token)).toBe("ghs_no_identity");
				expect(token.appSlug).toBeUndefined();
				expect(state.entries.has(STATE_KEY)).toBe(true);
			}),
		);
	});

	describe("client", () => {
		const persist = (state: ReturnType<typeof ActionStateTest.empty>) =>
			Effect.provide(
				Effect.flatMap(ActionState, (s) =>
					s.save(
						STATE_KEY,
						{
							token: Redacted.make("ghs_persisted"),
							expiresAt: "2099-01-01T00:00:00Z",
							installationId: 7,
							permissions: {},
						},
						InstallationTokenSchema,
					),
				),
				ActionStateTest.layer(state),
			);

		it.effect("builds a GitHubClient from the persisted token", () =>
			Effect.gen(function* () {
				const state = ActionStateTest.empty();
				yield* persist(state);

				const result = yield* Effect.provide(
					Effect.flatMap(GitHubClient, (c) => c.rest("op", () => Promise.resolve({ data: "ok" }))),
					GitHubToken.client().pipe(Layer.provide(ActionStateTest.layer(state))),
				);

				expect(result).toBe("ok");
				expect(octokitAuthCalls).toContain("ghs_persisted");
			}),
		);

		it.effect("fails when no token was provisioned", () =>
			Effect.gen(function* () {
				const state = ActionStateTest.empty();
				const exit = yield* Effect.exit(
					Effect.provide(
						Effect.flatMap(GitHubClient, (c) => c.repo),
						GitHubToken.client().pipe(Layer.provide(ActionStateTest.layer(state))),
					),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("dispose", () => {
		it.effect("revokes the persisted token", () =>
			Effect.gen(function* () {
				const state = ActionStateTest.empty();
				yield* Effect.provide(
					Effect.flatMap(ActionState, (s) =>
						s.save(
							STATE_KEY,
							{
								token: Redacted.make("ghs_to_revoke"),
								expiresAt: "2099-01-01T00:00:00Z",
								installationId: 7,
								permissions: {},
							},
							InstallationTokenSchema,
						),
					),
					ActionStateTest.layer(state),
				);
				const appState = GitHubAppTest.empty();

				yield* Effect.provide(
					GitHubToken.dispose(),
					Layer.mergeAll(ActionStateTest.layer(state), GitHubAppTest.layer(appState)),
				);

				expect(appState.revokeCalls.map((t) => Redacted.value(t))).toContain("ghs_to_revoke");
			}),
		);

		it.effect("is a no-op when no token was provisioned", () =>
			Effect.gen(function* () {
				const state = ActionStateTest.empty();
				const appState = GitHubAppTest.empty();

				yield* Effect.provide(
					GitHubToken.dispose(),
					Layer.mergeAll(ActionStateTest.layer(state), GitHubAppTest.layer(appState)),
				);

				expect(appState.revokeCalls).toHaveLength(0);
			}),
		);
	});

	describe("read", () => {
		it.effect("returns the persisted installation token with identity fields", () =>
			Effect.gen(function* () {
				const state = ActionStateTest.empty();
				yield* Effect.provide(
					Effect.flatMap(ActionState, (s) =>
						s.save(
							STATE_KEY,
							{
								token: Redacted.make("ghs_persisted"),
								expiresAt: "2099-01-01T00:00:00Z",
								installationId: 7,
								appSlug: "acme-bot",
								appUserId: 123456,
								appName: "Acme Bot",
								permissions: {},
							},
							InstallationTokenSchema,
						),
					),
					ActionStateTest.layer(state),
				);

				const token = yield* Effect.provide(GitHubToken.read(), ActionStateTest.layer(state));

				expect(Redacted.value(token.token)).toBe("ghs_persisted");
				expect(token.appSlug).toBe("acme-bot");
				expect(token.appUserId).toBe(123456);
				expect(token.appName).toBe("Acme Bot");
			}),
		);

		it.effect("fails when no token was provisioned", () =>
			Effect.gen(function* () {
				const state = ActionStateTest.empty();
				const exit = yield* Effect.exit(Effect.provide(GitHubToken.read(), ActionStateTest.layer(state)));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("botIdentity", () => {
		const persist = (state: ReturnType<typeof ActionStateTest.empty>, token: InstallationToken) =>
			Effect.provide(
				Effect.flatMap(ActionState, (s) => s.save(STATE_KEY, token, InstallationTokenSchema)),
				ActionStateTest.layer(state),
			);

		it.effect("derives a verified identity from the persisted token", () =>
			Effect.gen(function* () {
				const state = ActionStateTest.empty();
				yield* persist(state, {
					token: Redacted.make("ghs_persisted"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					appSlug: "acme-bot",
					appUserId: 123456,
					appName: "Acme Bot",
					permissions: {},
				});

				const identity: BotIdentity = yield* Effect.provide(GitHubToken.botIdentity(), ActionStateTest.layer(state));

				expect(identity).toEqual({
					name: "acme-bot[bot]",
					email: "123456+acme-bot[bot]@users.noreply.github.com",
				});
			}),
		);

		it.effect("falls back to github-actions[bot] when identity fields are absent", () =>
			Effect.gen(function* () {
				const state = ActionStateTest.empty();
				yield* persist(state, {
					token: Redacted.make("ghs_persisted"),
					expiresAt: "2099-01-01T00:00:00Z",
					installationId: 7,
					permissions: {},
				});

				const identity = yield* Effect.provide(GitHubToken.botIdentity(), ActionStateTest.layer(state));

				expect(identity).toEqual({
					name: "github-actions[bot]",
					email: "41898282+github-actions[bot]@users.noreply.github.com",
				});
			}),
		);
	});
});
