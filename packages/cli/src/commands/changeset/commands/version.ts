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

import type { Block } from "@effected/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { Report } from "../../../internal/report.js";
import { requireValidConfig } from "../utils/config-gate.js";

/* v8 ignore start -- CLI option definitions; handler tested via runVersion */
const dryRunOption = Flag.Boolean("dry-run").pipe(
	Flag.withAlias("n"),
	Flag.withDescription("Compute and report the release without writing anything"),
	Flag.withDefault(false),
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
		if (dryRun) {
			const result = yield* planner.apply(cwd, { dryRun });
			if (result.releases.length === 0) {
				yield* Report.print([Report.ok("No pending changesets")]);
				return;
			}
			yield* Report.print([
				...releaseBlocks(result.releases, true),
				...versionFileBlocks(result.versionFileUpdates, true),
			]);
			return;
		}

		// A real run prints each phase as apply reports it landing, so a failure
		// in a later phase still leaves what reached disk on stdout. Whatever no
		// step reported is printed from the result at the end.
		let engineReported = false;
		let versionFilesReported = false;
		const onStep = (step: Changesets.ApplyStep) =>
			Effect.suspend(() => {
				if (step._tag === "EngineApplied") {
					engineReported = true;
					return step.releases.length === 0
						? Effect.void
						: Report.print([
								...releaseBlocks(step.releases, false),
								Report.detail(`Touched ${step.touchedFiles.length} file(s)`),
							]);
				}
				versionFilesReported = true;
				return Report.print(versionFileBlocks(step.updates, false));
			});
		const result = yield* planner.apply(cwd, { onStep });

		if (result.releases.length === 0) {
			yield* Report.print([Report.ok("No pending changesets")]);
			return;
		}
		const remaining: Block[] = [];
		if (!engineReported) {
			remaining.push(
				...releaseBlocks(result.releases, false),
				Report.detail(`Touched ${result.touchedFiles.length} file(s)`),
			);
		}
		if (!versionFilesReported) remaining.push(...versionFileBlocks(result.versionFileUpdates, false));
		if (remaining.length > 0) yield* Report.print(remaining);
	});
}

/** One `✓` line per package release, plan-phrased on a dry run. */
const releaseBlocks = (releases: ReadonlyArray<Changesets.AppliedReleaseEntry>, dryRun: boolean): Block[] =>
	releases.map((r) =>
		Report.ok(`${dryRun ? "Would release" : "Released"} ${r.name}: ${r.oldVersion} -> ${r.newVersion} (${r.type})`),
	);

/** One detail line per versionFiles update, plan-phrased on a dry run. */
const versionFileBlocks = (updates: ReadonlyArray<Changesets.VersionFileUpdateRecord>, dryRun: boolean): Block[] =>
	updates.map((u) => Report.detail(`${dryRun ? "Would update" : "Updated"} ${u.filePath} -> ${u.version}`));

/* v8 ignore next 4 -- CLI registration; handler tested via runVersion */
export const versionCommand = Command.make("version", { dryRun: dryRunOption }, ({ dryRun }) =>
	runVersion(dryRun),
).pipe(Command.withDescription("Apply pending changesets: bump versions and transform CHANGELOGs"));
