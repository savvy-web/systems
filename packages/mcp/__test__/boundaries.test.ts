/**
 * Source-text boundaries for the MCP front end: the process is read only at
 * the edge (`bin.ts`, `main.ts`, and `version.ts`'s build-time define), and
 * everything under `src/` below it takes its facts as values.
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

	it.effect("only bin.ts, main.ts and version.ts touch process", () =>
		Effect.gen(function* () {
			const scan = yield* SourceBoundary.scan({
				root: SRC,
				rules: ["process", "node:process"],
				allow: ["bin.ts", "main.ts", "version.ts"],
			});
			expect(scan.violations).toEqual([]);
			expect(scan.allowed).toEqual(["bin.ts", "main.ts", "version.ts"]);
			expect(scan.files.length).toBeGreaterThan(10);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
