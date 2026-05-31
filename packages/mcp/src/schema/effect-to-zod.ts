/**
 * Bridge an Effect Schema to a zod schema by routing through JSON Schema, so a
 * tool keeps Effect Schema as the canonical source of truth while the MCP SDK
 * receives the zod instance its `registerTool` API requires.
 *
 * @packageDocumentation
 */

import type { Schema } from "effect";
import { JSONSchema } from "effect";
import { z } from "zod";

/**
 * Convert an Effect `Schema.Schema<A, I, never>` to a zod schema:
 * `JSONSchema.make`, then inline every `#/$defs/*` `$ref`, then `z.fromJSONSchema`.
 *
 * @remarks
 * - Effect-only refinements (custom predicates, brands) erase during the
 *   round-trip; declare zod directly if boundary enforcement matters.
 * - The source schema must not use `Schema.suspend` (recursive `$ref`s would
 *   make `inlineAllRefs` non-terminating). MCP tool output schemas in this
 *   package are non-recursive projections by construction.
 * - The MCP SDK normalises `outputSchema` to an object; non-object results
 *   (e.g. a bare union) are wrapped in a permissive object so the SDK accepts
 *   them.
 */
export const effectToZodSchema = <A, I>(schema: Schema.Schema<A, I, never>): z.ZodTypeAny => {
	const jsonSchema = JSONSchema.make(schema) as unknown as Record<string, unknown>;
	const inlined = inlineAllRefs(jsonSchema);
	const zodSchema = z.fromJSONSchema(inlined as never) as z.ZodTypeAny;
	if (isObjectLike(zodSchema)) return zodSchema;
	return z.object({}).catchall(z.unknown());
};

const isObjectLike = (schema: z.ZodTypeAny): boolean => schema instanceof z.ZodObject;

const REF_PREFIX = "#/$defs/";

/**
 * Replace every `$ref: "#/$defs/X"` node with the contents of `$defs.X`,
 * recursively, and drop the `$defs` table. Assumes acyclic refs.
 */
const inlineAllRefs = (root: Record<string, unknown>): Record<string, unknown> => {
	const defs = (root.$defs ?? {}) as Record<string, Record<string, unknown>>;
	const visit = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(visit);
		if (value === null || typeof value !== "object") return value;
		const obj = value as Record<string, unknown>;
		if (typeof obj.$ref === "string" && obj.$ref.startsWith(REF_PREFIX)) {
			const defName = obj.$ref.slice(REF_PREFIX.length);
			const target = defs[defName];
			if (target !== undefined) return visit(target);
		}
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(obj)) {
			if (k === "$defs") continue;
			out[k] = visit(v);
		}
		return out;
	};
	return visit(root) as Record<string, unknown>;
};
