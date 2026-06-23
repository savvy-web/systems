import { createHash, createHmac } from "node:crypto";

/** Arguments for signing a single S3 object request. @internal */
export interface SignS3Args {
	readonly method: "GET" | "PUT" | "HEAD";
	readonly bucket: string;
	readonly region: string;
	readonly accessKeyId: string;
	readonly secretAccessKey: string;
	readonly sessionToken?: string;
	/** Object key WITHOUT leading slash (prefix already applied by caller). */
	readonly key: string;
	/** Custom endpoint host (e.g. "https://<account>.r2.cloudflarestorage.com"). Omit for AWS. */
	readonly endpoint?: string;
	/** Hex SHA-256 of the request body; empty-body hash for GET/HEAD. */
	readonly payloadHash: string;
	/** Override clock for tests (YYYYMMDDTHHMMSSZ). Defaults to now. */
	readonly amzDate?: string;
}

const sha256Hex = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");
const hmac = (key: Uint8Array | string, data: string): Buffer => createHmac("sha256", key).update(data).digest();

const nowAmzDate = (): string => new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");

/** Resolve the request base URL (path-style) and signed header map. @internal */
const resolveParts = (
	args: SignS3Args,
): { base: string; host: string; canonicalUri: string; headers: Map<string, string> } => {
	const base = args.endpoint ? args.endpoint.replace(/\/$/, "") : `https://s3.${args.region}.amazonaws.com`;
	const host = new URL(base).host;
	// Path-style: /<bucket>/<key>. Encode each key segment, keep slashes.
	const encodedKey = args.key.split("/").map(encodeURIComponent).join("/");
	const canonicalUri = `/${args.bucket}/${encodedKey}`;
	// All signed headers are lowercase keys; sorting is done at use sites.
	const headers = new Map<string, string>([
		["host", host],
		["x-amz-content-sha256", args.payloadHash],
		["x-amz-date", args.amzDate ?? nowAmzDate()],
	]);
	if (args.sessionToken) headers.set("x-amz-security-token", args.sessionToken);
	return { base, host, canonicalUri, headers };
};

/**
 * Build the SigV4 canonical request string. Exposed for deterministic testing —
 * this is where header ordering/casing bugs surface.
 * @internal
 */
export const buildCanonicalRequest = (args: SignS3Args): string => {
	const { canonicalUri, headers } = resolveParts(args);
	const names = [...headers.keys()].sort();
	const canonicalHeaders = names.map((n) => `${n}:${headers.get(n)}\n`).join("");
	const signedHeaders = names.join(";");
	return [args.method, canonicalUri, "", canonicalHeaders, signedHeaders, args.payloadHash].join("\n");
};

/**
 * Sign an S3 request with AWS Signature Version 4. Path-style addressing so a
 * custom `endpoint` (R2/MinIO/Spaces) works without virtual-host DNS.
 * @internal
 */
export const signS3Request = (args: SignS3Args): { url: string; headers: Record<string, string> } => {
	const amzDate = args.amzDate ?? nowAmzDate();
	const dateStamp = amzDate.slice(0, 8);
	const service = "s3";
	const { base, canonicalUri, headers: headerMap } = resolveParts({ ...args, amzDate });
	const names = [...headerMap.keys()].sort();
	const signedHeaders = names.join(";");

	const scope = `${dateStamp}/${args.region}/${service}/aws4_request`;
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256Hex(buildCanonicalRequest({ ...args, amzDate })),
	].join("\n");

	const kDate = hmac(`AWS4${args.secretAccessKey}`, dateStamp);
	const kRegion = hmac(kDate, args.region);
	const kService = hmac(kRegion, service);
	const kSigning = hmac(kService, "aws4_request");
	const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

	const outHeaders: Record<string, string> = {};
	for (const n of names) outHeaders[n] = headerMap.get(n) as string;
	outHeaders.Authorization = `AWS4-HMAC-SHA256 Credential=${args.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	return { url: `${base}${canonicalUri}`, headers: outHeaders };
};
