/**
 * Source-text boundaries for the MCP front end: the process is read only at
 * the edge (`main.ts`), and everything under `src/` below it takes its facts
 * as values. The one build-time define, `process.env.__PACKAGE_VERSION__`, is
 * confined to `version.ts` by a token rule rather than by exempting the file
 * from the `process` rules wholesale.
 */

import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { SourceBoundary } from "@effected/workspaces/testing";
import { Effect } from "effect";

const SRC = join(import.meta.dirname, "../src");

describe("mcp source boundaries", () => {
	it("the scanner still flags what it must and spares what it must", () => {
		expect(SourceBoundary.verifyFixtures()).toEqual([]);
	});

	it.effect("only main.ts touches process, and only version.ts reads the build-time version define", () =>
		Effect.gen(function* () {
			const scan = yield* SourceBoundary.scan({
				root: SRC,
				rules: ["process", "node:process", { forbidTokens: ["process.env.__PACKAGE_VERSION__"] }],
				allow: ["main.ts"],
				allowRules: { forbidTokens: ["version.ts"] },
			});
			expect(scan.violations).toEqual([]);
			expect(scan.allowed).toEqual(["main.ts"]);
			// Non-vacuity: the define is still read, and only where it is waived.
			expect(scan.waived.map((offence) => `${offence.file} ${offence.detail}`)).toEqual([
				"version.ts process.env.__PACKAGE_VERSION__",
			]);
			expect(scan.files.length).toBeGreaterThan(10);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
