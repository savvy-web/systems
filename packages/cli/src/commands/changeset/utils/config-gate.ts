/**
 * Shared "refuse on bad config" gate for CLI commands that must not run
 * with an invalid `.changeset/config.json`.
 *
 * @remarks
 * Used by `version` and `transform` in 0.9.0. Both commands are entry
 * points to release-shaped work; running them against a config that
 * fails the new validation contract (overlap, unknown package keys,
 * dual-shape, schema errors) would produce broken or inconsistent
 * output.
 *
 * `lint` deliberately does **not** call this gate — it operates on
 * changeset markdown files and must keep working while the user is
 * iterating on a config fix.
 *
 * Behavior:
 * - **No config present** (`.changeset/config.json` absent): the gate
 *   resolves to `void` and the caller proceeds. This preserves the
 *   pre-0.9.0 behavior where `transform` and `version` worked on
 *   projects that have not yet been bootstrapped.
 * - **Config present**: the gate invokes
 *   {@link ConfigInspector.inspect}. A `ConfigurationError` becomes a
 *   {@link CommandError} (the refusal, the config problem as its detail, and
 *   a `config validate` hint) that short-circuits the caller's `Effect.gen`;
 *   the runtime reports it on stderr and exits 1.
 *
 * @internal
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";

import { CommandError } from "../../../internal/command-error.js";

const { ConfigInspector } = Changesets;

/**
 * Require a valid `.changeset/config.json` (when one exists) before
 * proceeding. Resolves to `void` on a clean config OR on a project that
 * doesn't have a config at all; fails with a {@link CommandError} wrapping
 * the {@link ConfigurationError} on an invalid config.
 *
 * @param cwd - Project root (will be resolved against the process cwd)
 * @returns Effect that succeeds on valid/absent config, fails with
 *   {@link CommandError} otherwise
 *
 * @internal
 */
export function requireValidConfig(cwd: string): Effect.Effect<void, CommandError, Changesets.ConfigInspector> {
	return Effect.gen(function* () {
		const projectDir = resolve(cwd);
		const configPath = join(projectDir, ".changeset", "config.json");

		if (!existsSync(configPath)) {
			return;
		}

		const inspector = yield* ConfigInspector;
		yield* inspector.inspect(projectDir).pipe(
			Effect.catchTag("ConfigurationError", (err) =>
				Effect.fail(
					CommandError.from(err, {
						message: `refusing to run: ${configPath} is invalid`,
						hint: "Run savvy changeset config validate to see the full report.",
					}),
				),
			),
		);
	});
}
