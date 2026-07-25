/**
 * Step-1 tests for the Attest service: in-toto statement construction
 * + local file save through the in-memory FileSystem.
 *
 * @remarks
 * Subsequent steps (OIDC, sigstore bundle, GitHub upload) will land
 * their own targeted tests against test layers; this file stays scoped
 * to the pure builder + the save-to-disk path so it can survive the
 * upstreaming move to `@savvy-web/github-action-effects` unchanged.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import type { FileSystem } from "effect";
import { Effect, Layer } from "effect";
import {
	Attest,
	AttestLive,
	CYCLONEDX_BOM,
	IN_TOTO_STATEMENT_V1,
	SLSA_PROVENANCE_V1,
	npmPurl,
	serializeStatement,
	subject,
} from "../../src/testing.js";

const layer = Layer.merge(AttestLive, NodeFileSystem.layer);

const run = <A, E>(effect: Effect.Effect<A, E, Attest | FileSystem.FileSystem>) => Effect.provide(effect, layer);

describe("Attest service — step 1: statement + save", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "attest-step1-"));
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	describe("buildStatement", () => {
		it.effect("builds a valid in-toto v1 statement with single subject", () =>
			Effect.gen(function* () {
				const statement = yield* run(
					Effect.gen(function* () {
						const attest = yield* Attest;
						return yield* attest.buildStatement({
							subjects: [subject(npmPurl("@savvy-web/example", "1.0.0"), "a".repeat(64))],
							predicateType: SLSA_PROVENANCE_V1,
							predicate: { buildType: "https://example.com/build" },
						});
					}),
				);

				expect(statement._type).toBe(IN_TOTO_STATEMENT_V1);
				expect(statement.subject).toHaveLength(1);
				expect(statement.subject[0].name).toBe("pkg:npm/@savvy-web/example@1.0.0");
				expect(statement.subject[0].digest).toEqual({ sha256: "a".repeat(64) });
				expect(statement.predicateType).toBe(SLSA_PROVENANCE_V1);
				expect(statement.predicate).toEqual({ buildType: "https://example.com/build" });
			}),
		);

		it.effect("strips a leading `sha256:` prefix from the digest", () =>
			Effect.gen(function* () {
				const statement = yield* run(
					Effect.gen(function* () {
						const attest = yield* Attest;
						return yield* attest.buildStatement({
							subjects: [subject("pkg:npm/foo@1.0.0", `sha256:${"b".repeat(64)}`)],
							predicateType: CYCLONEDX_BOM,
							predicate: { bomFormat: "CycloneDX" },
						});
					}),
				);

				expect(statement.subject[0].digest).toEqual({ sha256: "b".repeat(64) });
			}),
		);

		it.effect("accepts multiple subjects in one statement", () =>
			Effect.gen(function* () {
				const statement = yield* run(
					Effect.gen(function* () {
						const attest = yield* Attest;
						return yield* attest.buildStatement({
							subjects: [subject("pkg:npm/a@1.0.0", "1".repeat(64)), subject("pkg:npm/b@2.0.0", "2".repeat(64))],
							predicateType: CYCLONEDX_BOM,
							predicate: { bomFormat: "CycloneDX", specVersion: "1.5" },
						});
					}),
				);

				expect(statement.subject).toHaveLength(2);
				expect(statement.subject.map((s) => s.name)).toEqual(["pkg:npm/a@1.0.0", "pkg:npm/b@2.0.0"]);
			}),
		);
	});

	describe("save", () => {
		it.effect("writes the statement as pretty-printed JSON", () =>
			Effect.gen(function* () {
				const outPath = join(tmp, "attestation.statement.json");

				yield* run(
					Effect.gen(function* () {
						const attest = yield* Attest;
						const statement = yield* attest.buildStatement({
							subjects: [subject(npmPurl("@savvy-web/example", "1.0.0"), "c".repeat(64))],
							predicateType: SLSA_PROVENANCE_V1,
							predicate: { foo: "bar" },
						});
						yield* attest.save(statement, outPath);
					}),
				);

				const written = readFileSync(outPath, "utf-8");
				const parsed = JSON.parse(written);
				expect(parsed._type).toBe(IN_TOTO_STATEMENT_V1);
				expect(parsed.subject[0].name).toBe("pkg:npm/@savvy-web/example@1.0.0");
				expect(written).toMatch(/^\{\n {2}/); // pretty-printed with 2-space indent
			}),
		);

		it.effect("round-trips through serializeStatement", () =>
			Effect.gen(function* () {
				const outPath = join(tmp, "roundtrip.statement.json");

				const statement = yield* run(
					Effect.gen(function* () {
						const attest = yield* Attest;
						const s = yield* attest.buildStatement({
							subjects: [subject("pkg:npm/x@1.2.3", "d".repeat(64))],
							predicateType: CYCLONEDX_BOM,
							predicate: { spec: "1.5" },
						});
						yield* attest.save(s, outPath);
						return s;
					}),
				);

				const onDisk = readFileSync(outPath, "utf-8");
				expect(onDisk).toBe(serializeStatement(statement));
			}),
		);
	});
});
