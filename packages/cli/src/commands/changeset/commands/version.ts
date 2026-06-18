/**
 * Version command -- natively apply pending changesets and report the result.
 *
 * Validates the config, then runs {@link ReleasePlanner.apply}, which bumps
 * versions, writes + transforms CHANGELOGs, deletes consumed changesets, and
 * updates configured versionFiles -- all without shelling out to a `changeset`
 * CLI binary.
 *
 * @internal
 */

import { Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";

import { requireValidConfig } from "../utils/config-gate.js";

/* v8 ignore start -- CLI option definitions; handler tested via runVersion */
const dryRunOption = Options.boolean("dry-run").pipe(
	Options.withAlias("n"),
	Options.withDescription("Compute and report the release without writing anything"),
	Options.withDefault(false),
);
/* v8 ignore stop */

/**
 * Validate config, then natively apply (or dry-run) the release via
 * {@link ReleasePlanner}.
 *
 * @param dryRun - When `true`, write nothing; only report planned changes.
 */
export function runVersion(dryRun: boolean) {
	return Effect.gen(function* () {
		const cwd = process.cwd();
		yield* requireValidConfig(cwd);

		const planner = yield* Changesets.ReleasePlanner;
		const result = yield* planner.apply(cwd, { dryRun });

		if (result.releases.length === 0) {
			yield* Effect.log("No pending changesets.");
			return;
		}
		const verb = dryRun ? "Would release" : "Released";
		for (const r of result.releases) {
			yield* Effect.log(`${verb} ${r.name}: ${r.oldVersion} -> ${r.newVersion} (${r.type})`);
		}
		if (!dryRun) {
			yield* Effect.log(`Touched ${result.touchedFiles.length} file(s)`);
		}
		for (const u of result.versionFileUpdates) {
			yield* Effect.log(`${dryRun ? "Would update" : "Updated"} ${u.filePath} -> ${u.version}`);
		}
	});
}

/* v8 ignore next 4 -- CLI registration; handler tested via runVersion */
export const versionCommand = Command.make("version", { dryRun: dryRunOption }, ({ dryRun }) =>
	runVersion(dryRun),
).pipe(Command.withDescription("Apply pending changesets: bump versions and transform CHANGELOGs"));
