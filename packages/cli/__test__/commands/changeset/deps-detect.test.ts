import { describe, expect, it } from "@effect/vitest";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Option } from "effect";

import { runDepsDetect } from "../../../src/commands/changeset/commands/deps-detect.js";
import { Capture } from "../../utils/capture.js";

const { DepsRegen } = Changesets;

const diff: Changesets.WorkspaceDependencyDiff = {
	package: "@scope/foo",
	relativePath: "packages/foo",
	rows: [{ dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.1" }],
};

const plan: Changesets.RegenPlan = {
	toDelete: [],
	toWrite: [{ file: "/repo/.changeset/foo.md", package: "@scope/foo", diff }],
	skippedMixed: [],
	coexisting: [],
};

const stub = Layer.succeed(DepsRegen, {
	plan: () => Effect.succeed(plan),
	execute: () => Effect.die("execute is never called by detect"),
});

/** Run detect for one audience and return its stdout entries. */
const detect = (json: boolean, markdown: boolean, options: Parameters<typeof Capture.run>[1] = {}) =>
	Capture.run(
		runDepsDetect("/repo", Option.none(), Option.none(), Option.none(), json, markdown).pipe(Effect.provide(stub)),
		options,
	).pipe(Effect.map((result) => result.stdout));

// The output is a contract (scripts parse the JSON, the markdown is pasted into
// `.changeset/*.md` files): pinned byte for byte, for every audience.
describe("savvy changeset deps detect (output contract)", () => {
	const audiences = [{}, { audience: "agent" as const }, { audience: "ci" as const, githubActions: true }];

	it.effect("emits the diffs as two-space-indented JSON by default", () =>
		Effect.gen(function* () {
			for (const options of audiences) {
				expect(yield* detect(false, false, options)).toEqual([JSON.stringify([diff], null, 2)]);
			}
		}),
	);

	it.effect("emits one CSH005 markdown block per package with --markdown", () =>
		Effect.gen(function* () {
			const expected = [
				"---",
				'"@scope/foo": patch',
				"---",
				"",
				"## Dependencies",
				"",
				Changesets.serializeDependencyTableToMarkdown([...diff.rows]),
			].join("\n");
			for (const options of audiences) {
				expect(yield* detect(false, true, options)).toEqual([expected]);
			}
		}),
	);

	it.effect("prefers JSON when both --json and --markdown are set", () =>
		Effect.gen(function* () {
			expect(yield* detect(true, true)).toEqual([JSON.stringify([diff], null, 2)]);
		}),
	);
});
