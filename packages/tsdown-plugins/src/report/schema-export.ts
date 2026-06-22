// packages/tsdown-plugins/src/report/schema-export.ts
import type { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import type { JsonSchemaError, JsonSchemaOutput } from "json-schema-effect";
import { JsonSchemaExporter } from "json-schema-effect";
import { BuildReport } from "./schema.js";

const SCHEMA_ID = "https://savvyweb.systems/schemas/build-report.schema.json";

/**
 * Generate the SchemaStore-compatible JSON Schema document for BuildReport.
 *
 * @remarks
 * Build-time tooling helper: its return type depends on `@effect/platform`'s
 * `FileSystem` service (a devDependency, not part of this package's public
 * contract), so it is internal rather than part of the consumer surface.
 *
 * @internal
 */
export const generateBuildReportSchema = (): Effect.Effect<JsonSchemaOutput, JsonSchemaError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const exporter = yield* JsonSchemaExporter;
		return yield* exporter.generate({
			name: "build-report",
			schema: BuildReport,
			rootDefName: "BuildReport",
			$id: SCHEMA_ID,
		});
	}).pipe(Effect.provide(JsonSchemaExporter.Live));
