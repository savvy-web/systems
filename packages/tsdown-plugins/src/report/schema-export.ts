// packages/tsdown-plugins/src/report/schema-export.ts
import { Effect, JsonSchema, Schema } from "effect";
import { BuildReport } from "./schema.js";

const SCHEMA_ID = "https://savvyweb.systems/schemas/build-report.schema.json";

const ROOT_DEF_NAME = "BuildReport";

/**
 * The generated JSON Schema document for the BuildReport schema.
 *
 * @internal
 */
export interface BuildReportSchemaOutput {
	readonly name: string;
	readonly schema: Record<string, unknown>;
}

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
		const document = JsonSchema.resolveTopLevel$ref(Schema.toJsonSchemaDocument(BuildReport));
		const definitions: Record<string, unknown> = { ...document.definitions };
		// The root definition is inlined at the top level; drop its (now redundant) $defs entry.
		delete definitions[ROOT_DEF_NAME];
		const schema: Record<string, unknown> = {
			$schema: JsonSchema.META_SCHEMA_URI_DRAFT_2020_12,
			$id: SCHEMA_ID,
			...document.schema,
			...(Object.keys(definitions).length > 0 ? { $defs: definitions } : {}),
		};
		return { name: "build-report", schema };
	});
