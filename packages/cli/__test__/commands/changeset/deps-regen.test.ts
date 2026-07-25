import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Option } from "effect";

import { runDepsRegen } from "../../../src/commands/changeset/commands/deps-regen.js";

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
};

const cannedResult: Changesets.RegenResult = {
	deleted: cannedPlan.toDelete.map((entry) => entry.file),
	written: cannedPlan.toWrite.map((entry) => entry.file),
	skippedMixed: cannedPlan.skippedMixed,
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
		let out = "";
		const original = console.log;
		// biome-ignore lint/suspicious/noExplicitAny: console.log spy for capture
		console.log = ((...args: any[]): void => {
			out += `${args.map((a) => (typeof a === "string" ? a : String(a))).join(" ")}\n`;
		}) as typeof console.log;
		yield* Effect.ensuring(
			runDepsRegen(cwd, base, pkg, dryRun, json).pipe(Effect.provide(layer)),
			Effect.sync(() => {
				console.log = original;
			}),
		);
		return out;
	});
}

// `it.live` throughout: `collectStdout` spies on the REAL `console.log`, and
// `it.effect` installs `TestConsole`, which captures Effect's `Console.log`
// writes so they never reach the spy (leaving `out` empty and the JSON.parse
// assertions failing).
describe("savvy changeset deps regen (adapter)", () => {
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.exitCode = savedExitCode;
	});

	it.live("produces a dry-run plan with no devDependency rows and does not call execute", () =>
		Effect.gen(function* () {
			let executeCalled = false;
			const layer = makeStubLayer(() => {
				executeCalled = true;
			});

			const out = yield* collectStdout("/repo", true, true, layer);
			const rendered: Changesets.RegenPlan = JSON.parse(out);

			expect(rendered).toEqual(cannedPlan);
			for (const entry of rendered.toWrite) {
				expect(entry.diff.rows.some((row) => row.type === "devDependency")).toBe(false);
			}
			expect(executeCalled).toBe(false);
		}),
	);

	it.live("forwards cwd, base, and package to DepsRegen.plan", () =>
		Effect.gen(function* () {
			let received: Changesets.DepsRegenOptions | undefined;
			const layer = makeStubLayer(undefined, (options) => {
				received = options;
			});

			yield* collectStdout("/repo", true, true, layer, Option.some("develop"), Option.some("@scope/foo"));

			expect(received).toMatchObject({ cwd: "/repo", base: "develop", package: "@scope/foo" });
		}),
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
		}),
	);
});
