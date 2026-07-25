/**
 * Item-4 test: `Schema.encodeEffect(SigstoreBundle)` produces the same wire shape as
 * the prior `JSON.parse(JSON.stringify(bundle))` round-trip used in `AttestLive`.
 */

import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE, SigstoreBundle } from "../../src/testing.js";

const stubBundle = (): SigstoreBundle =>
	new SigstoreBundle({
		mediaType: SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE,
		verificationMaterial: {
			tlogEntries: [{ logIndex: "42", canonicalizedBody: "Ym9keQ==" }],
			certificate: { rawBytes: "Y2VydA==" },
		},
		dsseEnvelope: {
			payload: "base64-payload",
			payloadType: "application/vnd.in-toto+json",
			signatures: [{ sig: "c2ln" }],
		},
	});

describe("SigstoreBundle encode", () => {
	it.effect("encodes the SigstoreBundle to the same wire shape as the JSON round-trip", () =>
		Effect.gen(function* () {
			const bundle = stubBundle();
			const jsonRoundTrip = JSON.parse(JSON.stringify(bundle));
			const encoded = yield* Schema.encodeEffect(SigstoreBundle)(bundle);
			expect(encoded).toEqual(jsonRoundTrip);
		}),
	);

	it.effect("preserves the mediaType literal and the opaque material/envelope payloads", () =>
		Effect.gen(function* () {
			const bundle = stubBundle();
			const encoded = (yield* Schema.encodeEffect(SigstoreBundle)(bundle)) as Record<string, unknown>;
			expect(encoded.mediaType).toBe(SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE);
			expect(encoded.verificationMaterial).toEqual(bundle.verificationMaterial);
			expect(encoded.dsseEnvelope).toEqual(bundle.dsseEnvelope);
		}),
	);
});
