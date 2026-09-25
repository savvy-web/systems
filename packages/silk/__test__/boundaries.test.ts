/**
 * The non-import invariant, held at the source: silk, cli and mcp never import
 * each other, with ONE sanctioned exception — silk's two carrier shims under
 * `src/bin/` import `@savvy-web/cli/main` and `@savvy-web/mcp/main`. The
 * built-artifact side (each shim imports its `./main` and nothing else) is
 * pinned by `externals.test.ts`.
 */

import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { SourceBoundary } from "@effected/workspaces/testing";
import { Effect } from "effect";

const SRC = join(import.meta.dirname, "../src");

describe("silk source boundaries", () => {
	it("the scanner still flags what it must and spares what it must", () => {
		expect(SourceBoundary.verifyFixtures()).toEqual([]);
	});

	it.effect("only the carrier shims in src/bin import @savvy-web/cli or @savvy-web/mcp", () =>
		Effect.gen(function* () {
			const scan = yield* SourceBoundary.scan({
				root: SRC,
				rules: [{ forbidImports: ["@savvy-web/cli", "@savvy-web/cli/*", "@savvy-web/mcp", "@savvy-web/mcp/*"] }],
				allowRules: { forbidImports: ["bin/savvy.ts", "bin/savvy-mcp.ts"] },
			});
			expect(scan.violations).toEqual([]);
			// Non-vacuity: the two shims were scanned and each import was waived, not missed.
			expect(scan.waived.map((offence) => `${offence.file} ${offence.detail}`)).toEqual([
				"bin/savvy-mcp.ts @savvy-web/mcp/main",
				"bin/savvy.ts @savvy-web/cli/main",
			]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
