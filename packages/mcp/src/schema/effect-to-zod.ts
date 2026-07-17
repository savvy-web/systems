/**
 * Bridge an Effect Schema to a zod schema by routing through JSON Schema, so a
 * tool keeps Effect Schema as the canonical source of truth while the MCP SDK
 * receives the zod instance its `registerTool` API requires.
 *
 * @packageDocumentation
 */

import { Schema } from "effect";
import { z } from "zod";

/**
 * Convert an Effect `Schema.Codec<A, I>` to a zod schema:
 * `Schema.toJsonSchemaDocument`, then inline every `#/$defs/*` `$ref` and
 * normalize back to the wire contract, then `z.fromJSONSchema`.
 *
 * @remarks
 * - Effect-only refinements (custom predicates, brands) erase during the
 *   round-trip; declare zod directly if boundary enforcement matters.
 * - The source schema must not use `Schema.suspend` (recursive `$ref`s would
 *   make the inlining pass non-terminating). MCP tool output schemas in this
 *   package are non-recursive projections by construction.
 * - The MCP SDK normalises `outputSchema` to an object; non-object results
 *   (e.g. a bare union) are wrapped in a permissive object so the SDK accepts
 *   them.
 */
export const effectToZodSchema = <A, I>(schema: Schema.Codec<A, I>): z.ZodTypeAny => {
	const inlined = effectSchemaToInlinedJsonSchema(schema);
	const zodSchema = z.fromJSONSchema(inlined as never) as z.ZodTypeAny;
	if (isObjectLike(zodSchema)) return zodSchema;
	return z.object({}).catchall(z.unknown());
};

const isObjectLike = (schema: z.ZodTypeAny): boolean => schema instanceof z.ZodObject;

/**
 * Produce the inlined, normalized JSON Schema object handed to
 * `z.fromJSONSchema`. Exposed separately so schema-snapshot tooling can
 * serialize exactly what the bridge feeds zod.
 *
 * @remarks
 * v4's `Schema.toJsonSchemaDocument` returns `{ dialect, schema, definitions }`
 * with every identifier-annotated subschema hoisted into `definitions` and
 * referenced as `#/$defs/<name>` — including the root itself. Two v4 encoding
 * changes are normalized back to the v3-era wire contract here (in the bridge,
 * never in the public schemas):
 *
 * - `Schema.Number` now encodes non-finite values as strings, emitting
 *   `anyOf: [number, "NaN", "Infinity", "-Infinity"]`. Tool results never
 *   carry non-finite numbers, so this collapses to `{ type: "number" }`.
 * - `Schema.optional(S)` now admits `undefined`, emitting
 *   `anyOf: [S, { type: "null" }]` on the (already non-required) key. The
 *   handlers build results with conditional spreads and never emit
 *   `undefined`/`null` for optional keys, so the null arm is dropped.
 *   Deliberate `Schema.NullOr` fields are all on required keys and keep
 *   their null arm.
 * - Filter checks (`isMinLength`, `isPattern`, …) now emit as
 *   `allOf: [{ minLength: 1 }]` instead of inline keywords. Bare-constraint
 *   `allOf` members are folded back into the parent node.
 */
export const effectSchemaToInlinedJsonSchema = <A, I>(schema: Schema.Codec<A, I>): Record<string, unknown> => {
	const doc = Schema.toJsonSchemaDocument(schema);
	return inlineAllRefs(doc.schema as unknown as Record<string, unknown>, doc.definitions as unknown as Defs);
};

type Defs = Record<string, Record<string, unknown>>;

const REF_PREFIX = "#/$defs/";

/** A JSON-schema node matching `{ "type": "null" }` exactly. */
const isNullSchema = (value: unknown): boolean => {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const obj = value as Record<string, unknown>;
	return obj.type === "null" && Object.keys(obj).length === 1;
};

/** A JSON-schema node matching `{ "type": "string", "enum": ["NaN" | "Infinity" | "-Infinity"] }`. */
const isNonFiniteArm = (value: unknown): boolean => {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const obj = value as Record<string, unknown>;
	if (obj.type !== "string" || !Array.isArray(obj.enum) || obj.enum.length !== 1) return false;
	const literal = obj.enum[0];
	return literal === "NaN" || literal === "Infinity" || literal === "-Infinity";
};

/** A JSON-schema node matching `{ "type": "number" }` exactly. */
const isPlainNumberArm = (value: unknown): boolean => {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const obj = value as Record<string, unknown>;
	return obj.type === "number" && Object.keys(obj).length === 1;
};

/** JSON-schema keywords that are pure value constraints (no structural meaning). */
const CONSTRAINT_KEYS = new Set([
	"minLength",
	"maxLength",
	"pattern",
	"minimum",
	"maximum",
	"exclusiveMinimum",
	"exclusiveMaximum",
	"multipleOf",
	"minItems",
	"maxItems",
	"format",
]);

/** A node whose every key is a pure value-constraint keyword. */
const isBareConstraint = (value: unknown): value is Record<string, unknown> => {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const keys = Object.keys(value as Record<string, unknown>);
	return keys.length > 0 && keys.every((k) => CONSTRAINT_KEYS.has(k));
};

/**
 * Fold `allOf` members that are bare constraint objects — v4's encoding of
 * filter checks — back into the parent node (v3 inlined them). Keys already
 * present on the parent are left inside `allOf` untouched.
 */
const flattenConstraintAllOf = (node: Record<string, unknown>): Record<string, unknown> => {
	const allOf = node.allOf;
	if (!Array.isArray(allOf)) return node;
	const remaining: Array<unknown> = [];
	const folded: Record<string, unknown> = {};
	for (const member of allOf) {
		if (!isBareConstraint(member) || Object.keys(member).some((k) => k in node || k in folded)) {
			remaining.push(member);
			continue;
		}
		Object.assign(folded, member);
	}
	if (Object.keys(folded).length === 0) return node;
	const { allOf: _dropped, ...rest } = node;
	return remaining.length > 0 ? { ...rest, ...folded, allOf: remaining } : { ...rest, ...folded };
};

/**
 * Collapse v4's non-finite number encoding — `anyOf: [{ type: "number" },
 * "NaN", "Infinity", "-Infinity"]` — to `{ type: "number" }`, keeping any
 * sibling annotations (description, title) on the node.
 */
const collapseNonFiniteNumber = (node: Record<string, unknown>): Record<string, unknown> => {
	const anyOf = node.anyOf;
	if (!Array.isArray(anyOf) || anyOf.length !== 4) return node;
	const numberArms = anyOf.filter(isPlainNumberArm);
	const nonFiniteArms = anyOf.filter(isNonFiniteArm);
	if (numberArms.length !== 1 || nonFiniteArms.length !== 3) return node;
	const { anyOf: _dropped, ...siblings } = node;
	return { type: "number", ...siblings };
};

/**
 * Drop the `{ type: "null" }` arm that v4's `Schema.optional` adds for its
 * `undefined` case. Applied only to non-required properties, so deliberate
 * `Schema.NullOr` fields (all on required keys) keep their null arm.
 */
const dropUndefinedArm = (node: unknown): unknown => {
	if (node === null || typeof node !== "object" || Array.isArray(node)) return node;
	const obj = node as Record<string, unknown>;
	if (!Array.isArray(obj.anyOf)) return obj;
	const arms = obj.anyOf.filter((arm) => !isNullSchema(arm));
	if (arms.length === obj.anyOf.length) return obj;
	const { anyOf: _dropped, ...siblings } = obj;
	if (arms.length === 1 && arms[0] !== null && typeof arms[0] === "object" && !Array.isArray(arms[0])) {
		return collapseNonFiniteNumber({ ...(arms[0] as Record<string, unknown>), ...siblings });
	}
	return collapseNonFiniteNumber({ anyOf: arms, ...siblings });
};

/**
 * Replace every `$ref: "#/$defs/X"` node with the contents of
 * `definitions.X`, recursively, and normalize the v4 encoding deltas back to
 * the wire contract. Assumes acyclic refs.
 */
const inlineAllRefs = (root: Record<string, unknown>, defs: Defs): Record<string, unknown> => {
	const visit = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(visit);
		if (value === null || typeof value !== "object") return value;
		const obj = value as Record<string, unknown>;
		if (typeof obj.$ref === "string" && obj.$ref.startsWith(REF_PREFIX)) {
			const target = defs[obj.$ref.slice(REF_PREFIX.length)];
			if (target !== undefined) return visit(target);
		}
		const required = Array.isArray(obj.required) ? (obj.required as ReadonlyArray<unknown>) : [];
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(obj)) {
			if (k === "$defs") continue;
			if (k === "properties" && v !== null && typeof v === "object" && !Array.isArray(v)) {
				const props: Record<string, unknown> = {};
				for (const [propKey, propValue] of Object.entries(v as Record<string, unknown>)) {
					const visited = visit(propValue);
					props[propKey] = required.includes(propKey) ? visited : dropUndefinedArm(visited);
				}
				out[k] = props;
				continue;
			}
			out[k] = visit(v);
		}
		return collapseNonFiniteNumber(flattenConstraintAllOf(out));
	};
	return visit(root) as Record<string, unknown>;
};
