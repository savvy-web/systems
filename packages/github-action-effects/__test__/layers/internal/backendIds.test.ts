import { afterEach, describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import type { ArtifactError } from "../../../src/errors/ArtifactError.js";
import { getBackendIdsFromToken } from "../../../src/layers/internal/backendIds.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a synthetic (unsigned) JWT carrying the given payload. */
const makeToken = (payload: Record<string, unknown>): string => {
	const b64url = (obj: unknown): string =>
		Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;
};

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.exit(effect);

const extractError = (exit: Exit.Exit<unknown, ArtifactError>): ArtifactError | undefined =>
	Exit.isFailure(exit) ? Option.getOrUndefined(Cause.findErrorOption(exit.cause)) : undefined;

afterEach(() => {
	delete process.env.ACTIONS_RUNTIME_TOKEN;
});

describe("getBackendIdsFromToken", () => {
	it.effect("extracts run + job backend ids from a synthetic scp claim", () =>
		Effect.gen(function* () {
			const token = makeToken({
				scp: "Actions.Results:run-backend-id:job-backend-id Actions.UploadArtifacts:Other",
			});
			const exit = yield* run(getBackendIdsFromToken(token, "test-artifact", "upload"));
			expect(Exit.isSuccess(exit)).toBe(true);
			if (Exit.isSuccess(exit)) {
				expect(exit.value).toEqual({
					workflowRunBackendId: "run-backend-id",
					workflowJobRunBackendId: "job-backend-id",
				});
			}
		}),
	);

	it.effect("fails when the Actions.Results scope is absent", () =>
		Effect.gen(function* () {
			const token = makeToken({ scp: "Actions.UploadArtifacts:Create Actions.Generic:Read" });
			const exit = yield* run(getBackendIdsFromToken(token, "test-artifact", "upload"));
			expect(Exit.isFailure(exit)).toBe(true);
			const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
			expect(error?._tag).toBe("ArtifactError");
			expect(error?.reason).toContain("Actions.Results");
		}),
	);

	it.effect("fails when the scp claim is missing entirely", () =>
		Effect.gen(function* () {
			const token = makeToken({ sub: "no-scope-here" });
			const exit = yield* run(getBackendIdsFromToken(token, "test-artifact", "list"));
			expect(Exit.isFailure(exit)).toBe(true);
			const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
			expect(error?.reason).toContain("scp");
		}),
	);

	it.effect("fails when the token is not a 3-segment JWT", () =>
		Effect.gen(function* () {
			const exit = yield* run(getBackendIdsFromToken("not-a-jwt", "test-artifact", "upload"));
			expect(Exit.isFailure(exit)).toBe(true);
			const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
			expect(error?._tag).toBe("ArtifactError");
		}),
	);
});

describe("getBackendIdsFromEnv", () => {
	it.effect("reads ACTIONS_RUNTIME_TOKEN and decodes the backend ids", () =>
		Effect.gen(function* () {
			const { getBackendIdsFromEnv } = yield* Effect.promise(
				() => import("../../../src/layers/internal/backendIds.js"),
			);
			process.env.ACTIONS_RUNTIME_TOKEN = makeToken({
				scp: "Actions.Results:env-run-id:env-job-id",
			});
			const exit = yield* run(getBackendIdsFromEnv("test-artifact", "upload"));
			expect(Exit.isSuccess(exit)).toBe(true);
			if (Exit.isSuccess(exit)) {
				expect(exit.value).toEqual({
					workflowRunBackendId: "env-run-id",
					workflowJobRunBackendId: "env-job-id",
				});
			}
		}),
	);

	it.effect("fails when ACTIONS_RUNTIME_TOKEN is unset", () =>
		Effect.gen(function* () {
			const { getBackendIdsFromEnv } = yield* Effect.promise(
				() => import("../../../src/layers/internal/backendIds.js"),
			);
			delete process.env.ACTIONS_RUNTIME_TOKEN;
			const exit = yield* run(getBackendIdsFromEnv("test-artifact", "upload"));
			expect(Exit.isFailure(exit)).toBe(true);
			const error = extractError(exit as Exit.Exit<unknown, ArtifactError>);
			expect(error?.reason).toContain("ACTIONS_RUNTIME_TOKEN");
		}),
	);
});
