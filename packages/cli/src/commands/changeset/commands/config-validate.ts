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
 * savvy-changesets config validate
 * savvy-changesets config validate ./path/to/project
 * ```
 *
 * @internal
 */

import { resolve } from "node:path";
import { Args, Command } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";

const { ConfigInspector } = Changesets;

/* v8 ignore next */
const dirArg = Args.directory({ name: "dir" }).pipe(Args.withDefault("."));

/**
 * Run validation. Logs a one-line OK on success; logs the error and sets
 * `process.exitCode = 1` on failure.
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
			yield* Effect.log(`OK  ${config.configPath} — ${pkgCount} package${pkgCount === 1 ? "" : "s"} declared${note}`);
			return;
		}

		yield* Effect.log(`FAIL  ${result.field}: ${result.reason}`);
		process.exitCode = 1;
	});
}

/* v8 ignore next 5 -- CLI registration */
export const configValidateCommand = Command.make("validate", { dir: dirArg }, ({ dir }) =>
	runConfigValidate(dir),
).pipe(Command.withDescription("Validate .changeset/config.json without rendering it"));
