import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { CommitHashSchema, VersionTypeSchema } from "../../src/changesets/schemas/git.js";

describe("CommitHashSchema", () => {
	const decode = Schema.decodeUnknownSync(CommitHashSchema);

	it("accepts valid short hashes (7+ hex chars)", () => {
		expect(decode("abc123d")).toBe("abc123d");
		expect(decode("abc123def456")).toBe("abc123def456");
	});

	it("accepts a full 40-char SHA-1 hash", () => {
		const full = "a".repeat(40);
		expect(decode(full)).toBe(full);
	});

	it("rejects hashes shorter than 7 characters", () => {
		expect(() => decode("abc12")).toThrow(/7 or more lowercase hexadecimal/);
	});

	it("rejects uppercase hex characters", () => {
		expect(() => decode("ABC123D")).toThrow(/Uppercase letters are not allowed/);
	});

	it("rejects non-hex characters", () => {
		expect(() => decode("xyz123d")).toThrow(/lowercase hexadecimal characters/);
	});

	it("rejects non-strings", () => {
		expect(() => decode(123)).toThrow();
	});
});

describe("VersionTypeSchema", () => {
	const decode = Schema.decodeUnknownSync(VersionTypeSchema);

	it.each(["major", "minor", "patch", "none"])("accepts '%s'", (type) => {
		expect(decode(type)).toBe(type);
	});

	it("rejects invalid version types", () => {
		expect(() => decode("breaking")).toThrow();
		expect(() => decode("MAJOR")).toThrow();
		expect(() => decode("")).toThrow();
	});
});
