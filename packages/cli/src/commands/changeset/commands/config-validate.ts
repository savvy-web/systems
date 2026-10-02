/**
 * `config validate` command -- validate-only mode for `.changeset/config.json`.
 *
 * @remarks
 * Invokes {@link ConfigInspector.inspect} solely for its side effect of
 * surfacing {@link ConfigurationError}. On success prints a short OK
 * summary and exits 0. On error prints the structured failure (field +
 * reason) and exits non-zero.
 *
 * Used by CI gates and by the `version` / `transform` commands' refusal
 * posture in Phase 5.
 *
 * @example
 * ```bash
 * savvy changeset config validate
 * savvy changeset config validate ./path/to/project
 * ```
 *
 * @internal
 */

import { join, resolve } from "node:path";
import { CliExit } from "@effected/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { Report } from "../../../internal/report.js";

const { ConfigInspector } = Changesets;

/* v8 ignore next */
const dirArg = Argument.Directory("dir").pipe(Argument.withDefault("."));

/**
 * Run validation and print the outcome as one stdout line: `✓ <config> —
 * N packages declared` on success, `✗ <config> — field: reason` plus exit
 * code 1 through `CliExit.set` on a finding. Both outcomes stay on stdout as
 * `Report` lines (not `CliMessage`, whose failure line goes to stderr), so a
 * gate reading the result reads one stream.
 *
 * @internal
 */
export function runConfigValidate(dir: string) {
	return Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		const resolved = resolve(dir);
		const result = yield* inspector.inspect(resolved).pipe(
			Effect.map((config) => ({ ok: true as const, config })),
			Effect.catchTag("ConfigurationError", (err) =>
				Effect.succeed({ ok: false as const, field: err.field, reason: err.reason }),
			),
		);

		if (result.ok) {
			const { config } = result;
			const pkgCount = config.packages.length;
			const note = config.legacyVersionFilesUsed ? " (warning: legacy versionFiles in use)" : "";
			yield* Report.print([
				Report.ok(`${config.configPath} — ${pkgCount} package${pkgCount === 1 ? "" : "s"} declared${note}`),
			]);
			return;
		}

		yield* Report.print([
			Report.fail(`${join(resolved, ".changeset", "config.json")} — ${result.field}: ${result.reason}`),
		]);
		yield* CliExit.set(1);
	});
}

/* v8 ignore next 5 -- CLI registration */
export const configValidateCommand = Command.make("validate", { dir: dirArg }, ({ dir }) =>
	runConfigValidate(dir),
).pipe(Command.withDescription("Validate .changeset/config.json without rendering it"));
