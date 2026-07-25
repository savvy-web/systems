import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { z } from "zod";

import { effectToZodSchema } from "../../src/schema/effect-to-zod.js";

const Example = Schema.Struct({
	name: Schema.String,
	count: Schema.Number,
	tags: Schema.Array(Schema.String),
}).annotate({ identifier: "Example" });

describe("effectToZodSchema", () => {
	it("produces an object-typed zod schema that parses a conforming value", () => {
		const zodSchema = effectToZodSchema(Example);
		const parsed = zodSchema.parse({ name: "a", count: 1, tags: ["x"] });
		expect(parsed).toEqual({ name: "a", count: 1, tags: ["x"] });
	});

	it("returns a zod schema instance", () => {
		const zodSchema = effectToZodSchema(Example);
		expect(zodSchema).toBeInstanceOf(z.ZodType);
	});
});
