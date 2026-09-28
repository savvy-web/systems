/**
 * Owns the process. `index.ts` must stay importable without side effects;
 * never import this module from the barrel.
 *
 * @remarks
 * Assembles the `Command.run` Effect over `rootCommand`, provides the merged
 * `AppLive` stack and the carrier-aware version formatter, and hands the
 * program to `@effected/cli`'s `CliRuntime.main`, which provides the platform
 * and the kit-default CLI logger (every log line on stderr), reports failures
 * through that logger (a typed failure as one line, a defect as a bug report),
 * applies the `CliExit` code a command set, and exits `64` on a usage error
 * with the help document on stderr, so stdout stays clean for a caller that
 * parses it. The version formatter rides in `platform`, not `program`: help
 * routing only sees a Formatter provided there.
 * No type casts: the layer graph is validated by the compiler.
 *
 * @packageDocumentation
 */
/* v8 ignore start -- bootstrap; commands tested individually, the bin by __test__/e2e/bin.e2e.test.ts */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { CliColor, CliRuntime } from "@effected/cli";
import type { Distribution } from "@effected/engine";
import { CurrentDistribution } from "@effected/engine";
import { Effect, Layer, Option } from "effect";
import { Command } from "effect/cli";

import { AppLive, CliPlatform, rootCommand } from "./cli/index.js";
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
	const VersionFormatterLive = CliColor.formatterLayer({
		formatVersion: (name, version) => VersionLine.format(name, version, distribution),
	});
	const program = Command.run(rootCommand, { version: CLI_VERSION }).pipe(
		Effect.provide(AppLive),
		Effect.provideService(CurrentDistribution, distribution),
	);
	// The formatter goes through `platform` so `helpOnUsageError` can reroute the
	// help it formats; provided inside `program`, main would never see it.
	const platform = VersionFormatterLive.pipe(Layer.provideMerge(CliPlatform));
	// The kit-default logger: every log line goes to stderr, so stdout carries only
	// what a command prints as its result (`Output`), JSON, and hook envelopes —
	// and, under `helpOnUsageError: "stderr"`, never the help for a usage error.
	NodeRuntime.runMain(CliRuntime.main(program, { platform, render: FailureLine.render, helpOnUsageError: "stderr" }));
};
/* v8 ignore stop */
