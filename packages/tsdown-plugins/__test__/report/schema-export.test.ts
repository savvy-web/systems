// packages/tsdown-plugins/__test__/report/schema-export.test.ts

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { generateBuildReportSchema } from "../../src/report/schema-export.js";

describe("generateBuildReportSchema", () => {
	it.effect("produces a SchemaStore-shaped JSON Schema with $id and BuildReport root", () =>
		Effect.gen(function* () {
			const out = yield* generateBuildReportSchema();
			expect(out.schema.$schema).toBeDefined();
			expect(out.schema.$id).toContain("build-report");
			// root inlined (no self-$ref at top)
			expect(out.schema.$ref).toBeUndefined();
		}),
	);
});
