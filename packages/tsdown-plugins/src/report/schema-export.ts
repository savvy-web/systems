// packages/tsdown-plugins/src/report/schema-export.ts
import { Effect, JsonSchema, Schema } from "effect";
import { BuildReport } from "./schema.js";

const SCHEMA_ID = "https://savvyweb.systems/schemas/build-report.schema.json";

const DEFS_REF_PREFIX = "#/$defs/";

/**
 * The generated JSON Schema document for the BuildReport schema.
 *
 * @internal
 */
export interface BuildReportSchemaOutput {
	readonly name: string;
	readonly schema: Record<string, unknown>;
}

interface ResolvedRoot {
	readonly root: JsonSchema.JsonSchema;
	readonly definitions: Record<string, JsonSchema.JsonSchema>;
}

/**
 * Inline a document whose root is a bare `$ref` into `#/$defs`.
 *
 * @remarks
 * Core used to expose `JsonSchema.resolveTopLevel$ref` for this; it is no
 * longer part of the public v4 surface (the equivalent lives in an internal
 * module), so the SchemaStore shape is assembled here. The root definition is
 * looked up by the name carried in the `$ref` — not a hard-coded one — and
 * dropped from `$defs` once inlined.
 */
const resolveTopLevelRef = (document: JsonSchema.Document<"draft-2020-12">): ResolvedRoot => {
	const definitions: Record<string, JsonSchema.JsonSchema> = { ...document.definitions };
	const ref = document.schema.$ref;
	if (typeof ref !== "string" || !ref.startsWith(DEFS_REF_PREFIX)) {
		return { root: document.schema, definitions };
	}
	const key = decodeURIComponent(ref.slice(DEFS_REF_PREFIX.length)).replaceAll("~1", "/").replaceAll("~0", "~");
	const target = definitions[key];
	if (target === undefined) {
		return { root: document.schema, definitions };
	}
	delete definitions[key];
	// Keep any sibling keywords the root carried alongside its `$ref`.
	const { $ref: _dropped, ...siblings } = document.schema;
	return { root: { ...target, ...siblings }, definitions };
};

/**
 * Generate the SchemaStore-compatible JSON Schema document for BuildReport.
 *
 * @remarks
 * Build-time tooling helper generated from the `BuildReport` schema via core
 * `Schema.toJsonSchemaDocument`: the root definition is inlined (no top-level
 * `$ref`), remaining definitions live under `$defs`, and the document carries
 * a SchemaStore-convention `$id`. Internal rather than part of the consumer
 * surface.
 *
 * @internal
 */
export const generateBuildReportSchema = (): Effect.Effect<BuildReportSchemaOutput> =>
	Effect.sync(() => {
		const { root, definitions } = resolveTopLevelRef(Schema.toJsonSchemaDocument(BuildReport));
		const schema: Record<string, unknown> = {
			$schema: JsonSchema.META_SCHEMA_URI_DRAFT_2020_12,
			$id: SCHEMA_ID,
			...root,
			...(Object.keys(definitions).length > 0 ? { $defs: definitions } : {}),
		};
		return { name: "build-report", schema };
	});
