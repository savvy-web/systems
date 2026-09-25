/**
 * Owns the process. `index.ts` must stay importable without side effects;
 * never import this module from the barrel.
 *
 * @remarks
 * Assembles the `Command.run` Effect over `rootCommand`, provides the merged
 * `AppLive` stack and the carrier-aware version formatter, and hands the
 * program to `@effected/cli`'s `CliRuntime.main`, which provides the platform
 * and the CLI logger, reports failures through that logger (never stdout),
 * applies the `CliExit` code a command set, and exits `64` on a usage error.
 * No type casts: the layer graph is validated by the compiler.
 *
 * @packageDocumentation
 */
/* v8 ignore start -- bootstrap; commands tested individually, the bin by __test__/e2e/bin.e2e.test.ts */
import { NodeRuntime } from "@effect/platform-node";
import { CliColor, CliLogger, CliRuntime } from "@effected/cli";
import type { Distribution } from "@effected/engine";
import { CurrentDistribution } from "@effected/engine";
import { Effect, Layer, Option } from "effect";
import { Command } from "effect/unstable/cli";

import { AppLive, CliPlatform, rootCommand } from "./cli/index.js";
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
	const VersionFormatterLive = CliColor.formatterLayer({
		formatVersion: (name, version) => VersionLine.format(name, version, distribution),
	});
	const program = Command.run(rootCommand, { version: CLI_VERSION }).pipe(
		Effect.provide(Layer.merge(AppLive, VersionFormatterLive)),
		Effect.provideService(CurrentDistribution, distribution),
	);
	NodeRuntime.runMain(
		CliRuntime.main(program, {
			platform: CliPlatform,
			// Info and warning lines stay on stdout until every command writes its
			// results through `Output`; errors and failure reports go to stderr.
			logger: CliLogger.layer({ stderrFrom: "Error" }),
		}),
	);
};
/* v8 ignore stop */
