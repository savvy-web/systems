import { describe, expect, it } from "@effect/vitest";
import { buildCanonicalRequest, signS3Request } from "../../../src/layers/internal/sigv4.js";

const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const fixed = {
	method: "GET" as const,
	bucket: "examplebucket",
	region: "us-east-1",
	accessKeyId: "AKIAIOSFODNN7EXAMPLE",
	secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
	key: "test.txt",
	amzDate: "20130524T000000Z",
	payloadHash: EMPTY,
};

describe("buildCanonicalRequest", () => {
	it("produces the exact path-style canonical request (sorted, lowercase headers)", () => {
		// Path-style host, /<bucket>/<key>, three signed headers in sorted order.
		const expected = [
			"GET",
			"/examplebucket/test.txt",
			"",
			"host:s3.us-east-1.amazonaws.com",
			`x-amz-content-sha256:${EMPTY}`,
			"x-amz-date:20130524T000000Z",
			"",
			"host;x-amz-content-sha256;x-amz-date",
			EMPTY,
		].join("\n");
		expect(buildCanonicalRequest(fixed)).toBe(expected);
	});
});

describe("signS3Request", () => {
	it("emits sorted lowercase signed headers and a 64-hex signature", () => {
		const { headers } = signS3Request(fixed);
		expect(headers.Authorization).toMatch(
			/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
		);
		expect(headers["x-amz-content-sha256"]).toBe(EMPTY);
		expect(headers["x-amz-date"]).toBe("20130524T000000Z");
	});

	it("includes the session token header (and signs it) when present", () => {
		const cr = buildCanonicalRequest({ ...fixed, sessionToken: "TOKEN" });
		expect(cr).toContain("x-amz-security-token:TOKEN");
		expect(cr).toContain("host;x-amz-content-sha256;x-amz-date;x-amz-security-token");
	});
});
