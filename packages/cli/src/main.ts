/**
 * Owns the process. `index.ts` must stay importable without side effects;
 * never import this module from the barrel.
 *
 * @remarks
 * Runs `rootCommand` through `CliAudience.run`, which resolves `--audience`,
 * `--human`, `--agent` and `--ci` before core parses, provides the merged
 * `AppLive` stack and `CliConfigLive` (core's built-in flags minus
 * `--wizard`), and hands the program to `@effected/cli`'s
 * `CliRuntime.main`. Its `env` builds the presentation environment once — the
 * audience (overridable through `SAVVY_AUDIENCE`), the terminal, the theme,
 * editor links and the prompt gate — installs `CliLog` (diagnostics opt-in
 * through `SAVVY_LOG_LEVEL`, every log line on stderr) and the coloured help
 * formatter with the carrier-aware `--version` line. `main` reports failures
 * through that logger (a typed failure as one line, a defect as a bug
 * report), applies the `CliExit` code a command set, and exits `64` on a
 * usage error with the help document on stderr, so stdout stays clean for a
 * caller that parses it.
 * No type casts: the layer graph is validated by the compiler.
 *
 * @packageDocumentation
 */
/* v8 ignore start -- bootstrap; commands tested individually, the bin by __test__/e2e/bin.e2e.test.ts */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { CliAudience, CliRuntime } from "@effected/cli";
import type { Distribution } from "@effected/engine";
import { CurrentDistribution } from "@effected/engine";
import { Effect, Layer, Option } from "effect";

import { AppLive, CliConfigLive, CliPlatform, rootCommand } from "./cli/index.js";
import { FailureLine } from "./internal/failure-line.js";
import { VersionLine } from "./internal/version-line.js";
import { CLI_VERSION } from "./version.js";

/**
 * Options for {@link main}.
 *
 * @public
 */
export interface MainOptions {
	/**
	 * The carrier this bin was installed through, for example
	 * `{ name: "@savvy-web/silk", version }`; `--version` names it. Absent for
	 * a direct install.
	 */
	readonly distribution?: Distribution | undefined;
}

/**
 * Bootstrap and run the `savvy` CLI application. Owns the process.
 *
 * @public
 */
export const main = (options: MainOptions = {}): void => {
	const distribution = Option.fromNullishOr(options.distribution);
	const program = CliAudience.run(rootCommand, { version: CLI_VERSION }).pipe(
		Effect.provide(Layer.merge(AppLive, CliConfigLive)),
		Effect.provideService(CurrentDistribution, distribution),
	);
	NodeRuntime.runMain(
		CliRuntime.main(program, {
			platform: CliPlatform,
			env: {
				audienceEnvVar: "SAVVY_AUDIENCE",
				// Core's `Stdio` reports only stdout; the stderr theme needs the real answer.
				stderrIsTerminal: Effect.sync(() => process.stderr.isTTY === true),
				log: { envVar: "SAVVY_LOG_LEVEL" },
				formatter: { formatVersion: (name, version) => VersionLine.format(name, version, distribution) },
			},
			render: FailureLine.render,
			helpOnUsageError: "stderr",
		}),
	);
};
/* v8 ignore stop */
