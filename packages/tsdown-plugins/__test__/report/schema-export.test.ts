// packages/tsdown-plugins/__test__/report/schema-export.test.ts

import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { generateBuildReportSchema } from "../../src/report/schema-export.js";

describe("generateBuildReportSchema", () => {
	it("produces a SchemaStore-shaped JSON Schema with $id and BuildReport root", async () => {
		const out = await Effect.runPromise(generateBuildReportSchema().pipe(Effect.provide(NodeContext.layer)));
		expect(out.schema.$schema).toBeDefined();
		expect(out.schema.$id).toContain("build-report");
		// root inlined (no self-$ref at top)
		expect(out.schema.$ref).toBeUndefined();
	});
});
