/**
 * Step-7 tests for the Attest service: AttestTest + SbomTest layers.
 *
 * @remarks
 * Exercises the test-layer factories themselves. Downstream packages
 * will use these to wire `Attest` and `Sbom` into their own tests
 * without spinning up Sigstore or GitHub.
 */

import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer } from "effect";
import {
	Attest,
	AttestError,
	AttestTestFullLayer,
	CYCLONEDX_BOM,
	IN_TOTO_STATEMENT_V1,
	SLSA_PROVENANCE_V1,
	Sbom,
	SbomTest,
	makeAttestTestState,
	makeSbomTestState,
	npmPurl,
	subject,
} from "../../src/testing.js";

describe("AttestTest — step 7", () => {
	it.effect(".empty() returns a working layer with default attestation id and repo", () =>
		Effect.gen(function* () {
			const record = yield* Effect.gen(function* () {
				const attest = yield* Attest;
				return yield* attest.attest({
					subjects: [subject("pkg:npm/x@1.0.0", "a".repeat(64))],
					predicateType: SLSA_PROVENANCE_V1,
					predicate: {},
				});
			}).pipe(Effect.provide(AttestTestFullLayer()));

			expect(record.attestationId).toBe(1);
			expect(record.attestationUrl).toBe("https://github.com/test-owner/test-repo/attestations/1");
			expect(record.statement._type).toBe(IN_TOTO_STATEMENT_V1);
		}),
	);

	it.effect(".layer(state) records every method call into state", () =>
		Effect.gen(function* () {
			const state = makeAttestTestState({ attestationId: 99, repo: "acme/widgets" });

			yield* Effect.gen(function* () {
				const attest = yield* Attest;
				yield* attest.buildStatement({
					subjects: [subject("pkg:npm/a@1.0.0", "1".repeat(64))],
					predicateType: SLSA_PROVENANCE_V1,
					predicate: {},
				});
				yield* attest.attest({
					subjects: [subject("pkg:npm/b@1.0.0", "2".repeat(64))],
					predicateType: SLSA_PROVENANCE_V1,
					predicate: {},
				});
				yield* attest.sbom({
					rootName: "@savvy-web/example",
					rootVersion: "1.0.0",
					subjectSha256: "3".repeat(64),
					dependencies: [{ name: "lodash", version: "4.17.21" }],
				});
				yield* attest.provenance({
					subjectName: "pkg:npm/c@1.0.0",
					subjectSha256: "4".repeat(64),
					predicate: { buildDefinition: {}, runDetails: {} },
				});
			}).pipe(Effect.provide(AttestTestFullLayer(state)));

			expect(state.buildStatementCalls).toHaveLength(1);
			expect(state.attestCalls).toHaveLength(1);
			expect(state.sbomCalls).toHaveLength(1);
			expect(state.provenanceCalls).toHaveLength(1);

			expect(state.buildStatementCalls[0].subjects[0].name).toBe("pkg:npm/a@1.0.0");
			expect(state.sbomCalls[0].rootName).toBe("@savvy-web/example");
			expect(state.provenanceCalls[0].subjectName).toBe("pkg:npm/c@1.0.0");
		}),
	);

	it.effect("returned records use the configured attestation id and repo", () =>
		Effect.gen(function* () {
			const state = makeAttestTestState({ attestationId: 42, repo: "acme/widgets" });

			const record = yield* Effect.gen(function* () {
				const attest = yield* Attest;
				return yield* attest.sbom({
					rootName: "root",
					rootVersion: "1.0.0",
					subjectSha256: "a".repeat(64),
					dependencies: [],
				});
			}).pipe(Effect.provide(AttestTestFullLayer(state)));

			expect(record.attestationId).toBe(42);
			expect(record.attestationUrl).toBe("https://github.com/acme/widgets/attestations/42");
			expect(record.statement.predicateType).toBe(CYCLONEDX_BOM);
		}),
	);

	it.effect("save() records the path and data without touching disk", () =>
		Effect.gen(function* () {
			const state = makeAttestTestState();

			yield* Effect.gen(function* () {
				const attest = yield* Attest;
				const statement = yield* attest.buildStatement({
					subjects: [subject(npmPurl("@savvy-web/example", "1.0.0"), "a".repeat(64))],
					predicateType: SLSA_PROVENANCE_V1,
					predicate: {},
				});
				yield* attest.save(statement, "/tmp/should-never-be-written.json");
			}).pipe(Effect.provide(Layer.merge(AttestTestFullLayer(state), NodeFileSystem.layer)));

			expect(state.saves.size).toBe(1);
			expect(state.saves.has("/tmp/should-never-be-written.json")).toBe(true);
		}),
	);

	it.effect("failWith causes every method to fail with the configured error", () =>
		Effect.gen(function* () {
			const failure = new AttestError({ reason: "upload", message: "simulated 503" });
			const state = makeAttestTestState({ failWith: failure });

			const exit = yield* Effect.gen(function* () {
				const attest = yield* Attest;
				return yield* attest.attest({
					subjects: [subject("pkg:npm/x@1.0.0", "a".repeat(64))],
					predicateType: SLSA_PROVENANCE_V1,
					predicate: {},
				});
			}).pipe(Effect.provide(AttestTestFullLayer(state)), Effect.exit);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const f = Cause.findErrorOption(exit.cause);
				expect(f._tag).toBe("Some");
				if (f._tag === "Some") {
					expect(f.value._tag).toBe("AttestError");
					expect(f.value.reason).toBe("upload");
					expect(f.value.message).toBe("simulated 503");
				}
			}
			// Calls still get recorded even when failWith is set — that's
			// useful for asserting the SUT tried to do the right thing
			// before the error surfaced.
			expect(state.attestCalls).toHaveLength(1);
		}),
	);
});

describe("SbomTest — step 7", () => {
	it.effect(".empty() returns a minimal CycloneDX 1.5 BOM", () =>
		Effect.gen(function* () {
			const json = yield* Effect.gen(function* () {
				const sbom = yield* Sbom;
				const bom = yield* sbom.generate({
					rootName: "root",
					rootVersion: "1.0.0",
					dependencies: [],
				});
				return yield* sbom.serializeJson(bom);
			}).pipe(Effect.provide(SbomTest.empty()));

			const parsed = JSON.parse(json) as { bomFormat: string; specVersion: string };
			expect(parsed.bomFormat).toBe("CycloneDX");
			expect(parsed.specVersion).toBe("1.5");
		}),
	);

	it.effect(".layer(state) records generate calls and save paths", () =>
		Effect.gen(function* () {
			const state = makeSbomTestState();

			yield* Effect.gen(function* () {
				const sbom = yield* Sbom;
				const bom = yield* sbom.generate({
					rootName: "@savvy-web/example",
					rootVersion: "1.0.0",
					dependencies: [{ name: "lodash", version: "4.17.21" }],
				});
				yield* sbom.save(bom, "/tmp/bom.json");
			}).pipe(Effect.provide(Layer.merge(SbomTest.layer(state), NodeFileSystem.layer)));

			expect(state.generateCalls).toHaveLength(1);
			expect(state.generateCalls[0].rootName).toBe("@savvy-web/example");
			expect(state.saves.size).toBe(1);
			expect(state.saves.has("/tmp/bom.json")).toBe(true);
		}),
	);

	it.effect("jsonResponse override is returned from serializeJson", () =>
		Effect.gen(function* () {
			const state = makeSbomTestState({ jsonResponse: '{"custom":"bom"}' });

			const json = yield* Effect.gen(function* () {
				const sbom = yield* Sbom;
				const bom = yield* sbom.generate({ rootName: "r", rootVersion: "0", dependencies: [] });
				return yield* sbom.serializeJson(bom);
			}).pipe(Effect.provide(SbomTest.layer(state)));

			expect(json).toBe('{"custom":"bom"}');
		}),
	);
});
