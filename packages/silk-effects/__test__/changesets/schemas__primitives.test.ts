import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { NonEmptyString, PositiveInteger } from "../../src/changesets/schemas/primitives.js";

describe("NonEmptyString", () => {
	const decode = Schema.decodeUnknownSync(NonEmptyString);

	it("accepts non-empty strings", () => {
		expect(decode("hello")).toBe("hello");
		expect(decode("a")).toBe("a");
	});

	it("rejects empty strings", () => {
		expect(() => decode("")).toThrow();
	});

	it("rejects non-strings", () => {
		expect(() => decode(123)).toThrow();
		expect(() => decode(null)).toThrow();
	});
});

describe("PositiveInteger", () => {
	const decode = Schema.decodeUnknownSync(PositiveInteger);

	it("accepts positive integers", () => {
		expect(decode(1)).toBe(1);
		expect(decode(42)).toBe(42);
	});

	it("rejects zero", () => {
		expect(() => decode(0)).toThrow();
	});

	it("rejects negative numbers", () => {
		expect(() => decode(-1)).toThrow();
	});

	it("rejects non-integers", () => {
		expect(() => decode(1.5)).toThrow();
	});
});
