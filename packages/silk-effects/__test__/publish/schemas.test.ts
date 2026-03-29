import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PublishTarget, PublishTargetShorthand, ResolvedTarget } from "../../src/publish/schemas.js";

// ---------------------------------------------------------------------------
// PublishTargetShorthand
// ---------------------------------------------------------------------------

describe("PublishTargetShorthand", () => {
	it('accepts "npm"', () => {
		expect(Schema.decodeUnknownSync(PublishTargetShorthand)("npm")).toBe("npm");
	});

	it('accepts "github"', () => {
		expect(Schema.decodeUnknownSync(PublishTargetShorthand)("github")).toBe("github");
	});

	it('accepts "jsr"', () => {
		expect(Schema.decodeUnknownSync(PublishTargetShorthand)("jsr")).toBe("jsr");
	});

	it("rejects invalid string", () => {
		const result = Schema.decodeUnknownEither(PublishTargetShorthand)("pypi");
		expect(result._tag).toBe("Left");
	});

	it("rejects empty string", () => {
		const result = Schema.decodeUnknownEither(PublishTargetShorthand)("");
		expect(result._tag).toBe("Left");
	});

	it("rejects non-string values", () => {
		const result = Schema.decodeUnknownEither(PublishTargetShorthand)(42);
		expect(result._tag).toBe("Left");
	});
});

// ---------------------------------------------------------------------------
// PublishTarget — shorthand strings
// ---------------------------------------------------------------------------

describe("PublishTarget (shorthand)", () => {
	it('accepts "npm"', () => {
		expect(Schema.decodeUnknownSync(PublishTarget)("npm")).toBe("npm");
	});

	it('accepts "github"', () => {
		expect(Schema.decodeUnknownSync(PublishTarget)("github")).toBe("github");
	});

	it('accepts "jsr"', () => {
		expect(Schema.decodeUnknownSync(PublishTarget)("jsr")).toBe("jsr");
	});
});

// ---------------------------------------------------------------------------
// PublishTarget — custom URL strings
// ---------------------------------------------------------------------------

describe("PublishTarget (custom URL)", () => {
	it("accepts https:// URL", () => {
		expect(Schema.decodeUnknownSync(PublishTarget)("https://npm.pkg.github.com")).toBe("https://npm.pkg.github.com");
	});

	it("accepts another https:// URL", () => {
		expect(Schema.decodeUnknownSync(PublishTarget)("https://registry.npmjs.org")).toBe("https://registry.npmjs.org");
	});

	it("rejects http:// URL (non-https)", () => {
		const result = Schema.decodeUnknownEither(PublishTarget)("http://registry.npmjs.org");
		expect(result._tag).toBe("Left");
	});

	it("rejects arbitrary non-https string", () => {
		const result = Schema.decodeUnknownEither(PublishTarget)("ftp://example.com");
		expect(result._tag).toBe("Left");
	});
});

// ---------------------------------------------------------------------------
// PublishTarget — object targets
// ---------------------------------------------------------------------------

describe("PublishTarget (object)", () => {
	it("accepts object with protocol npm", () => {
		const result = Schema.decodeUnknownSync(PublishTarget)({ protocol: "npm" });
		expect(result).toMatchObject({ protocol: "npm" });
	});

	it("accepts object with protocol jsr", () => {
		const result = Schema.decodeUnknownSync(PublishTarget)({ protocol: "jsr" });
		expect(result).toMatchObject({ protocol: "jsr" });
	});

	it("applies default protocol when omitted", () => {
		const result = Schema.decodeUnknownSync(PublishTarget)({}) as { protocol: string };
		expect(result.protocol).toBe("npm");
	});

	it("accepts object with registry, access, and provenance", () => {
		const input = {
			protocol: "npm",
			registry: "https://npm.pkg.github.com",
			access: "public",
			provenance: true,
		};
		const result = Schema.decodeUnknownSync(PublishTarget)(input);
		expect(result).toMatchObject(input);
	});

	it("accepts object with all optional fields", () => {
		const input = {
			protocol: "npm",
			registry: "https://registry.npmjs.org",
			directory: "dist",
			access: "restricted",
			provenance: false,
			tag: "beta",
		};
		const result = Schema.decodeUnknownSync(PublishTarget)(input);
		expect(result).toMatchObject(input);
	});

	it("rejects object with invalid protocol", () => {
		const result = Schema.decodeUnknownEither(PublishTarget)({ protocol: "pypi" });
		expect(result._tag).toBe("Left");
	});

	it("rejects object with invalid access value", () => {
		const result = Schema.decodeUnknownEither(PublishTarget)({
			protocol: "npm",
			access: "private",
		});
		expect(result._tag).toBe("Left");
	});
});

// ---------------------------------------------------------------------------
// ResolvedTarget
// ---------------------------------------------------------------------------

describe("ResolvedTarget", () => {
	const validResolved = {
		protocol: "npm" as const,
		registry: "https://registry.npmjs.org",
		directory: "dist",
		access: "public" as const,
		provenance: true,
		tag: "latest",
		auth: "oidc" as const,
		tokenEnv: null,
	};

	it("validates a complete resolved target", () => {
		const result = Schema.decodeUnknownSync(ResolvedTarget)(validResolved);
		expect(result).toMatchObject(validResolved);
	});

	it("accepts null registry", () => {
		const result = Schema.decodeUnknownSync(ResolvedTarget)({ ...validResolved, registry: null });
		expect(result.registry).toBeNull();
	});

	it("accepts null tokenEnv", () => {
		const result = Schema.decodeUnknownSync(ResolvedTarget)({ ...validResolved, tokenEnv: null });
		expect(result.tokenEnv).toBeNull();
	});

	it("accepts token auth with tokenEnv", () => {
		const result = Schema.decodeUnknownSync(ResolvedTarget)({
			...validResolved,
			auth: "token",
			tokenEnv: "NPM_TOKEN",
		});
		expect(result.auth).toBe("token");
		expect(result.tokenEnv).toBe("NPM_TOKEN");
	});

	it("rejects missing required field: protocol", () => {
		const { protocol: _protocol, ...rest } = validResolved;
		const result = Schema.decodeUnknownEither(ResolvedTarget)(rest);
		expect(result._tag).toBe("Left");
	});

	it("rejects missing required field: directory", () => {
		const { directory: _directory, ...rest } = validResolved;
		const result = Schema.decodeUnknownEither(ResolvedTarget)(rest);
		expect(result._tag).toBe("Left");
	});

	it("rejects missing required field: access", () => {
		const { access: _access, ...rest } = validResolved;
		const result = Schema.decodeUnknownEither(ResolvedTarget)(rest);
		expect(result._tag).toBe("Left");
	});

	it("rejects missing required field: auth", () => {
		const { auth: _auth, ...rest } = validResolved;
		const result = Schema.decodeUnknownEither(ResolvedTarget)(rest);
		expect(result._tag).toBe("Left");
	});

	it("rejects invalid protocol value", () => {
		const result = Schema.decodeUnknownEither(ResolvedTarget)({ ...validResolved, protocol: "pypi" });
		expect(result._tag).toBe("Left");
	});

	it("rejects invalid auth value", () => {
		const result = Schema.decodeUnknownEither(ResolvedTarget)({ ...validResolved, auth: "api-key" });
		expect(result._tag).toBe("Left");
	});
});
