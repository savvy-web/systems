import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Option } from "effect";

import { runDepsRegen } from "../../../src/commands/changeset/commands/deps-regen.js";
import { Capture } from "../../utils/capture.js";
import { TestExit } from "../../utils/exit.js";

const { DepsRegen } = Changesets;

/**
 * A canned plan whose single `toWrite` entry carries only a `dependency`
 * row — the service has already dropped `devDependency` rows (the regen
 * default), so the adapter must not reintroduce or filter anything itself.
 */
const cannedPlan: Changesets.RegenPlan = {
	toDelete: [{ file: "/repo/.changeset/stale-changeset.md", package: "@scope/foo" }],
	toWrite: [
		{
			file: "/repo/.changeset/brave-dogs-laugh.md",
			package: "@scope/foo",
			diff: {
				package: "@scope/foo",
				relativePath: "packages/foo",
				rows: [{ dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.1" }],
			},
		},
	],
	skippedMixed: [],
	coexisting: [],
};

const cannedResult: Changesets.RegenResult = {
	deleted: cannedPlan.toDelete.map((entry) => entry.file),
	written: cannedPlan.toWrite.map((entry) => entry.file),
	skippedMixed: cannedPlan.skippedMixed,
	coexisting: cannedPlan.coexisting,
};

/**
 * Build a stub `Changesets.DepsRegen` layer. `onExecute` is invoked (if
 * provided) whenever `execute()` is called, so tests can assert whether or
 * not the adapter reached the write path.
 */
function makeStubLayer(
	onExecute?: () => void,
	onPlan?: (options: Changesets.DepsRegenOptions) => void,
): Layer.Layer<Changesets.DepsRegen> {
	return Layer.succeed(DepsRegen, {
		plan: (options) => {
			onPlan?.(options);
			return Effect.succeed(cannedPlan);
		},
		execute: (plan) => {
			onExecute?.();
			return Effect.succeed({ ...cannedResult, skippedMixed: plan.skippedMixed });
		},
	});
}

/**
 * Run `runDepsRegen` against a stub layer, collecting everything written to
 * stdout via `console.log` (the JSON path uses Effect's `Console.log`, a
 * bare `console.log` with no logger prefix).
 */
function collectStdout(
	cwd: string,
	dryRun: boolean,
	json: boolean,
	layer: Layer.Layer<Changesets.DepsRegen>,
	base: Option.Option<string> = Option.none(),
	pkg: Option.Option<string> = Option.none(),
) {
	return Effect.gen(function* () {
		const out: string[] = [];
		yield* runDepsRegen(cwd, base, pkg, dryRun, json).pipe(Effect.provide(Layer.mergeAll(layer, Capture.layer(out))));
		return out.join("\n");
	});
}

// `it.live` throughout: `collectStdout` spies on the REAL `console.log`, and
// `it.effect` installs `TestConsole`, which captures Effect's `Console.log`
// writes so they never reach the spy (leaving `out` empty and the JSON.parse
// assertions failing).
describe("savvy changeset deps regen (adapter)", () => {
	beforeEach(() => {
		TestExit.reset();
	});

	it.live("produces a dry-run plan with no devDependency rows and does not call execute", () =>
		Effect.gen(function* () {
			let executeCalled = false;
			const layer = makeStubLayer(() => {
				executeCalled = true;
			});

			const out = yield* collectStdout("/repo", true, true, layer);
			const rendered: Changesets.RegenPlan & { dryRun: boolean } = JSON.parse(out);

			expect(rendered).toEqual({ ...cannedPlan, dryRun: true });
			for (const entry of rendered.toWrite) {
				expect(entry.diff.rows.some((row) => row.type === "devDependency")).toBe(false);
			}
			expect(executeCalled).toBe(false);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.live("forwards cwd, base, and package to DepsRegen.plan", () =>
		Effect.gen(function* () {
			let received: Changesets.DepsRegenOptions | undefined;
			const layer = makeStubLayer(undefined, (options) => {
				received = options;
			});

			yield* collectStdout("/repo", true, true, layer, Option.some("develop"), Option.some("@scope/foo"));

			expect(received).toMatchObject({ cwd: "/repo", base: "develop", package: "@scope/foo" });
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.live("calls execute with the plan when --dry-run is not set", () =>
		Effect.gen(function* () {
			let receivedPlan: Changesets.RegenPlan | undefined;
			const layer = Layer.succeed(DepsRegen, {
				plan: () => Effect.succeed(cannedPlan),
				execute: (plan) => {
					receivedPlan = plan;
					return Effect.succeed(cannedResult);
				},
			});

			yield* collectStdout("/repo", false, true, layer);

			expect(receivedPlan).toEqual(cannedPlan);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.live("reports dryRun: false alongside the plan fields in real-run JSON", () =>
		Effect.gen(function* () {
			const out = yield* collectStdout("/repo", false, true, makeStubLayer());

			expect(JSON.parse(out)).toEqual({ ...cannedPlan, dryRun: false, result: cannedResult });
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.live("renders dry-run human output as a plan, not as completed work", () =>
		Effect.gen(function* () {
			const out = yield* collectStdout("/repo", true, false, makeStubLayer());

			expect(out).toContain("Would delete 1 pure dependency changeset(s):");
			expect(out).toContain("Would write 1 dependency changeset(s):");
			expect(out).toContain("/repo/.changeset/stale-changeset.md  (@scope/foo)");
			expect(out).toContain("+ /repo/.changeset/brave-dogs-laugh.md  (@scope/foo — 1 row)");
			expect(out).not.toContain("✓");
			expect(out).not.toContain("Deleted");
			expect(out).not.toContain("Wrote");
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.live("renders real-run human output as completed work", () =>
		Effect.gen(function* () {
			const out = yield* collectStdout("/repo", false, false, makeStubLayer());

			expect(out).toContain("✓ Deleted 1 pure dependency changeset(s):");
			expect(out).toContain("✓ Wrote 1 fresh dependency changeset(s):");
			expect(out).not.toContain("Would");
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.live("reports what execute actually deleted, not what the plan listed", () =>
		Effect.gen(function* () {
			// A tolerant delete that found nothing to remove (or could not
			// remove it) is absent from result.deleted, so the adapter must not claim it.
			const layer = Layer.succeed(DepsRegen, {
				plan: () => Effect.succeed(cannedPlan),
				execute: () => Effect.succeed({ ...cannedResult, deleted: [] }),
			});

			const out = yield* collectStdout("/repo", false, false, layer);

			expect(out).not.toContain("Deleted");
			expect(out).toContain("1 planned deletion(s) not removed (already gone or undeletable):");
			expect(out).toContain("/repo/.changeset/stale-changeset.md  (@scope/foo)");
			expect(out).toContain("✓ Wrote 1 fresh dependency changeset(s):");
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.live("carries execute's result in real-run JSON", () =>
		Effect.gen(function* () {
			const layer = Layer.succeed(DepsRegen, {
				plan: () => Effect.succeed(cannedPlan),
				execute: () => Effect.succeed({ ...cannedResult, deleted: [] }),
			});

			const out = yield* collectStdout("/repo", false, true, layer);

			expect(JSON.parse(out)).toEqual({ ...cannedPlan, dryRun: false, result: { ...cannedResult, deleted: [] } });
		}).pipe(Effect.provide(TestExit.layer)),
	);
});
