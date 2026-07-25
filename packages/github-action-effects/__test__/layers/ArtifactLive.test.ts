import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { vi } from "vitest";
import type { ArtifactError } from "../../src/errors/ArtifactError.js";
import { ArtifactLive } from "../../src/layers/ArtifactLive.js";
import { Artifact } from "../../src/services/Artifact.js";

// ---------------------------------------------------------------------------
// Azure SDK mock (mirrors ActionCacheLive.test.ts)
// ---------------------------------------------------------------------------

const mockUploadFile = vi.fn().mockResolvedValue(undefined);
const mockDownloadToFile = vi.fn().mockResolvedValue(undefined);

vi.mock("@azure/storage-blob", () => ({
	BlockBlobClient: class MockBlockBlobClient {
		uploadFile = mockUploadFile;
		constructor(public url: string) {}
	},
	BlobClient: class MockBlobClient {
		downloadToFile = mockDownloadToFile;
		constructor(public url: string) {}
	},
}));

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		createReadStream: vi.fn(),
		statSync: vi.fn(),
		unlinkSync: vi.fn(),
		mkdirSync: vi.fn(),
	};
});

import { execFileSync } from "node:child_process";
import { createReadStream, mkdirSync, statSync, unlinkSync } from "node:fs";

const mockedExecFileSync = vi.mocked(execFileSync);
const mockedCreateReadStream = vi.mocked(createReadStream);
const mockedStatSync = vi.mocked(statSync);
const mockedUnlinkSync = vi.mocked(unlinkSync);
const mockedMkdirSync = vi.mocked(mkdirSync);

// ---------------------------------------------------------------------------
// HttpClient (Twirp) mock
// ---------------------------------------------------------------------------

interface TwirpReply {
	readonly status: number;
	readonly body?: unknown;
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
			return HttpClientResponse.fromWeb(
				request,
				new Response(JSON.stringify(reply.body ?? null), {
					status: reply.status,
					headers: { "content-type": "application/json" },
				}),
			);
		}),
	),
);

const liveLayer = ArtifactLive.pipe(Layer.provide(mockHttpLayer));

const runExit = <A, E>(effect: Effect.Effect<A, E, Artifact>) => Effect.exit(Effect.provide(effect, liveLayer));

const extractError = (exit: Exit.Exit<unknown, ArtifactError>): ArtifactError | undefined => {
	if (Exit.isFailure(exit)) {
		const option = Cause.findErrorOption(exit.cause);
		if (Option.isSome(option)) return option.value;
	}
	return undefined;
};

const queue = (...replies: Array<TwirpReply>): void => {
	twirpReplies.push(...replies);
};

// A synthetic runtime token whose scp claim carries the backend ids.
const b64url = (obj: unknown): string =>
	Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const RUNTIME_TOKEN = `${b64url({ alg: "HS256" })}.${b64url({ scp: "Actions.Results:run-1:job-1" })}.sig`;

beforeEach(() => {
	twirpReplies = [];
	twirpCaptured = [];
});

// ---------------------------------------------------------------------------
// listArtifacts
// ---------------------------------------------------------------------------

describe("ArtifactLive", () => {
	describe("env guards", () => {
		afterEach(() => {
			vi.unstubAllEnvs();
		});

		it.effect("fails with ArtifactError when env vars are missing", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.listArtifacts()));
				expect(Exit.isFailure(exit)).toBe(true);
				const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
				expect(error?._tag).toBe("ArtifactError");
				expect(error?.reason).toContain("ACTIONS_RESULTS_URL");
			}),
		);

		it.effect("fails when the runtime token lacks an Actions.Results scope", () =>
			Effect.gen(function* () {
				vi.stubEnv("ACTIONS_RESULTS_URL", "https://results.example.com/");
				vi.stubEnv("ACTIONS_RUNTIME_TOKEN", `${b64url({ alg: "HS256" })}.${b64url({ scp: "Actions.Other:x" })}.sig`);
				const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.listArtifacts()));
				expect(Exit.isFailure(exit)).toBe(true);
				const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
				expect(error?.reason).toContain("Actions.Results");
			}),
		);
	});

	describe("with env vars set", () => {
		beforeEach(() => {
			vi.stubEnv("ACTIONS_RESULTS_URL", "https://results.example.com/");
			vi.stubEnv("ACTIONS_RUNTIME_TOKEN", RUNTIME_TOKEN);
			mockedExecFileSync.mockReturnValue(Buffer.from(""));
			mockedStatSync.mockReturnValue({ size: 1234 } as ReturnType<typeof statSync>);
			mockedUnlinkSync.mockReturnValue(undefined);
			mockedMkdirSync.mockReturnValue(undefined);
			mockUploadFile.mockResolvedValue(undefined);
			mockDownloadToFile.mockResolvedValue(undefined);
			// createReadStream feeds the sha256 hasher: emit a couple of chunks.
			mockedCreateReadStream.mockImplementation((() =>
				Readable.from([Buffer.from("zip-bytes-chunk")])) as unknown as typeof createReadStream);
		});

		afterEach(() => {
			vi.unstubAllEnvs();
			vi.clearAllMocks();
		});

		describe("listArtifacts", () => {
			it.effect("maps a ListArtifacts Twirp response to ArtifactItem[]", () =>
				Effect.gen(function* () {
					queue({
						status: 200,
						body: {
							artifacts: [
								{ databaseId: "11", name: "logs", size: "100", createdAt: "2026-01-01T00:00:00Z" },
								{ databaseId: "12", name: "dist", size: "200" },
							],
						},
					});

					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.listArtifacts()));
					expect(Exit.isSuccess(exit)).toBe(true);
					if (Exit.isSuccess(exit)) {
						expect(exit.value).toEqual([
							{ id: 11, name: "logs", size: 100, createdAt: "2026-01-01T00:00:00Z" },
							{ id: 12, name: "dist", size: 200 },
						]);
					}
					expect(twirpCaptured[0]?.url).toContain("twirp/github.actions.results.api.v1.ArtifactService/ListArtifacts");
					expect(twirpCaptured[0]?.body).toMatchObject({
						workflowRunBackendId: "run-1",
						workflowJobRunBackendId: "job-1",
					});
				}),
			);

			it.effect("returns [] when the backend lists none", () =>
				Effect.gen(function* () {
					queue({ status: 200, body: { artifacts: [] } });
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.listArtifacts()));
					expect(Exit.isSuccess(exit)).toBe(true);
					if (Exit.isSuccess(exit)) {
						expect(exit.value).toEqual([]);
					}
				}),
			);

			it.effect("fails with ArtifactError on a non-ok Twirp response", () =>
				Effect.gen(function* () {
					queue({ status: 400 });
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.listArtifacts()));
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.operation).toBe("list");
					expect(error?.reason).toContain("HTTP 400");
				}),
			);
		});

		describe("getArtifact", () => {
			it.effect("returns Option.some(item) for a matching name", () =>
				Effect.gen(function* () {
					queue({
						status: 200,
						body: { artifacts: [{ databaseId: "5", name: "dist", size: "9" }] },
					});
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.getArtifact("dist")));
					expect(Exit.isSuccess(exit)).toBe(true);
					if (Exit.isSuccess(exit)) {
						const opt = exit.value as Option.Option<{ id: number }>;
						expect(Option.isSome(opt)).toBe(true);
						if (Option.isSome(opt)) expect(opt.value.id).toBe(5);
					}
				}),
			);

			it.effect("returns Option.none() when no artifact matches the name", () =>
				Effect.gen(function* () {
					queue({
						status: 200,
						body: { artifacts: [{ databaseId: "5", name: "other", size: "9" }] },
					});
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.getArtifact("dist")));
					expect(Exit.isSuccess(exit)).toBe(true);
					if (Exit.isSuccess(exit)) {
						expect(Option.isNone(exit.value as Option.Option<unknown>)).toBe(true);
					}
				}),
			);
		});

		describe("uploadArtifact", () => {
			it.effect("runs CreateArtifact → blob upload → FinalizeArtifact and returns {id,size}", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { ok: true, signedUploadUrl: "https://azure.example.com/up" } },
						{ status: 200, body: { ok: true, artifactId: "42" } },
					);

					const exit = yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work")),
					);
					expect(Exit.isSuccess(exit)).toBe(true);
					if (Exit.isSuccess(exit)) {
						expect(exit.value).toEqual({ id: 42, size: 1234 });
					}
					expect(twirpCaptured[0]?.url).toContain("ArtifactService/CreateArtifact");
					// version 7 requires a mime_type (the backend 400s without it).
					expect(twirpCaptured[0]?.body).toMatchObject({ name: "dist", version: 7, mimeType: "application/zip" });
					expect(mockUploadFile).toHaveBeenCalled();
					expect(twirpCaptured[1]?.url).toContain("ArtifactService/FinalizeArtifact");
					const finalizeBody = twirpCaptured[1]?.body as { name: string; size: string; hash: string };
					expect(finalizeBody.name).toBe("dist");
					expect(finalizeBody.size).toBe("1234");
					expect(finalizeBody.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
				}),
			);

			it.effect("forwards retentionDays as an expiresAt on FinalizeArtifact", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { ok: true, signedUploadUrl: "https://azure.example.com/up" } },
						{ status: 200, body: { ok: true, artifactId: "42" } },
					);
					const before = Date.now();
					const exit = yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work", { retentionDays: 5 })),
					);
					expect(Exit.isSuccess(exit)).toBe(true);
					const finalizeBody = twirpCaptured[1]?.body as { expiresAt?: string };
					expect(finalizeBody.expiresAt).toBeDefined();
					const expiresMs = Date.parse(finalizeBody.expiresAt as string);
					// ~5 days out from now.
					expect(expiresMs).toBeGreaterThan(before + 4 * 86_400_000);
					expect(expiresMs).toBeLessThan(before + 6 * 86_400_000);
				}),
			);

			it.effect("passes compressionLevel to the POSIX zip flags", () =>
				Effect.gen(function* () {
					if (process.platform === "win32") return; // POSIX `zip` only
					queue(
						{ status: 200, body: { ok: true, signedUploadUrl: "https://azure.example.com/up" } },
						{ status: 200, body: { ok: true, artifactId: "42" } },
					);
					yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work", { compressionLevel: 1 })),
					);
					const zipCall = mockedExecFileSync.mock.calls.find((c) => c[0] === "zip");
					expect(zipCall).toBeDefined();
					expect((zipCall?.[1] as ReadonlyArray<string>)[0]).toBe("-1");
				}),
			);

			it.effect("fails when no files are provided", () =>
				Effect.gen(function* () {
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", [], "/work")));
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.operation).toBe("upload");
					expect(error?.reason).toContain("No files provided");
				}),
			);

			it.effect("fails with 'artifact already exists' when CreateArtifact returns ok:false", () =>
				Effect.gen(function* () {
					queue({ status: 200, body: { ok: false } });
					const exit = yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work")),
					);
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.operation).toBe("upload");
					expect(error?.reason).toContain("already exists");
				}),
			);

			it.effect("fails with 'artifact already exists' when CreateArtifact 409s", () =>
				Effect.gen(function* () {
					queue({ status: 409 });
					const exit = yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work")),
					);
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("already exists");
				}),
			);

			it.effect("cleans up the temp zip after a successful upload", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { ok: true, signedUploadUrl: "https://azure.example.com/up" } },
						{ status: 200, body: { ok: true, artifactId: "42" } },
					);
					yield* runExit(Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work")));
					expect(mockedUnlinkSync).toHaveBeenCalled();
				}),
			);

			it.effect("fails when blob upload rejects", () =>
				Effect.gen(function* () {
					queue({ status: 200, body: { ok: true, signedUploadUrl: "https://azure.example.com/up" } });
					mockUploadFile.mockRejectedValueOnce(new Error("Azure upload timeout"));
					const exit = yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work")),
					);
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("upload failed");
					expect(error?.reason).toContain("Azure upload timeout");
				}),
			);

			it.effect("fails when FinalizeArtifact returns ok:false", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { ok: true, signedUploadUrl: "https://azure.example.com/up" } },
						{ status: 200, body: { ok: false } },
					);
					const exit = yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work")),
					);
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("FinalizeArtifact did not confirm success");
				}),
			);

			it.effect("fails when CreateArtifact returns ok but no upload URL", () =>
				Effect.gen(function* () {
					queue({ status: 200, body: { ok: true } });
					const exit = yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work")),
					);
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("did not return a signed upload URL");
				}),
			);

			it.effect("fails when retentionDays is not positive", () =>
				Effect.gen(function* () {
					const exit = yield* runExit(
						Effect.flatMap(Artifact, (svc) => svc.uploadArtifact("dist", ["a.txt"], "/work", { retentionDays: 0 })),
					);
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("retentionDays");
				}),
			);
		});

		describe("downloadArtifact", () => {
			it.effect("resolves a signed URL, downloads, and unzips to the dest path", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { artifacts: [{ databaseId: "7", name: "dist", size: "9" }] } },
						{ status: 200, body: { signedUrl: "https://azure.example.com/down" } },
					);
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7, { path: "/dest" })));
					expect(Exit.isSuccess(exit)).toBe(true);
					if (Exit.isSuccess(exit)) {
						expect(exit.value).toEqual({ downloadPath: "/dest" });
					}
					expect(twirpCaptured[1]?.url).toContain("ArtifactService/GetSignedArtifactURL");
					expect(twirpCaptured[1]?.body).toMatchObject({ name: "dist" });
					expect(mockDownloadToFile).toHaveBeenCalled();
					// unzip shells out
					expect(mockedExecFileSync).toHaveBeenCalled();
				}),
			);

			it.effect("fails with ArtifactError when GetSignedArtifactURL is non-ok", () =>
				Effect.gen(function* () {
					queue({ status: 200, body: { artifacts: [{ databaseId: "7", name: "dist", size: "9" }] } }, { status: 400 });
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7)));
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.operation).toBe("download");
					expect(error?.reason).toContain("HTTP 400");
				}),
			);

			it.effect("cleans up the temp zip after extraction", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { artifacts: [{ databaseId: "7", name: "dist", size: "9" }] } },
						{ status: 200, body: { signedUrl: "https://azure.example.com/down" } },
					);
					yield* runExit(Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7, { path: "/dest" })));
					expect(mockedUnlinkSync).toHaveBeenCalled();
				}),
			);

			it.effect("fails when the artifact id is not found in the run", () =>
				Effect.gen(function* () {
					queue({ status: 200, body: { artifacts: [{ databaseId: "9", name: "other", size: "1" }] } });
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7)));
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("not found");
				}),
			);

			it.effect("fails when GetSignedArtifactURL returns no signed URL", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { artifacts: [{ databaseId: "7", name: "dist", size: "9" }] } },
						{ status: 200, body: {} },
					);
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7)));
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("did not return a signed URL");
				}),
			);

			it.effect("downloads to a fresh temp dir when no path is given", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { artifacts: [{ databaseId: "7", name: "dist", size: "9" }] } },
						{ status: 200, body: { signedUrl: "https://azure.example.com/down" } },
					);
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7)));
					expect(Exit.isSuccess(exit)).toBe(true);
					if (Exit.isSuccess(exit)) {
						expect(exit.value.downloadPath).toContain("artifact-download-");
					}
				}),
			);

			it.effect("fails when the blob download rejects", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { artifacts: [{ databaseId: "7", name: "dist", size: "9" }] } },
						{ status: 200, body: { signedUrl: "https://azure.example.com/down" } },
					);
					mockDownloadToFile.mockRejectedValueOnce(new Error("Azure download timeout"));
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7, { path: "/dest" })));
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("download failed");
					expect(error?.reason).toContain("Azure download timeout");
				}),
			);
		});

		describe("findBy (cross-run/cross-repo)", () => {
			const findBy = {
				token: "gh-token",
				workflowRunId: 99,
				repositoryOwner: "octo",
				repositoryName: "repo",
			} as const;

			it.effect("listArtifacts(findBy) fails as not yet implemented", () =>
				Effect.gen(function* () {
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.listArtifacts(findBy)));
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.reason).toContain("not yet implemented");
				}),
			);

			it.effect("getArtifact(name, findBy) fails as not yet implemented", () =>
				Effect.gen(function* () {
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.getArtifact("dist", findBy)));
					expect(Exit.isFailure(exit)).toBe(true);
				}),
			);

			it.effect("downloadArtifact(id, opts, findBy) fails as not yet implemented", () =>
				Effect.gen(function* () {
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.downloadArtifact(7, undefined, findBy)));
					expect(Exit.isFailure(exit)).toBe(true);
				}),
			);

			it.effect("deleteArtifact(name, findBy) fails as not yet implemented", () =>
				Effect.gen(function* () {
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.deleteArtifact("dist", findBy)));
					expect(Exit.isFailure(exit)).toBe(true);
				}),
			);
		});

		describe("deleteArtifact", () => {
			it.effect("calls DeleteArtifact and returns the deleted id", () =>
				Effect.gen(function* () {
					queue(
						{ status: 200, body: { artifacts: [{ databaseId: "3", name: "dist", size: "9" }] } },
						{ status: 200, body: { ok: true, artifactId: "3" } },
					);
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.deleteArtifact("dist")));
					expect(Exit.isSuccess(exit)).toBe(true);
					if (Exit.isSuccess(exit)) {
						expect(exit.value).toEqual({ id: 3 });
					}
					expect(twirpCaptured[1]?.url).toContain("ArtifactService/DeleteArtifact");
					expect(twirpCaptured[1]?.body).toMatchObject({ name: "dist" });
				}),
			);

			it.effect("fails when the named artifact does not exist", () =>
				Effect.gen(function* () {
					queue({ status: 200, body: { artifacts: [] } });
					const exit = yield* runExit(Effect.flatMap(Artifact, (svc) => svc.deleteArtifact("dist")));
					expect(Exit.isFailure(exit)).toBe(true);
					const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
					expect(error?.operation).toBe("delete");
					expect(error?.reason).toContain("not found");
				}),
			);
		});
	});
});
