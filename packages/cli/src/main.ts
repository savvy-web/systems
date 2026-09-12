/**
 * Owns the process. `index.ts` must stay importable without side effects;
 * never import this module from the barrel.
 *
 * @remarks
 * Assembles the `Command.run` Effect over `rootCommand`, provides the merged
 * `AppLive` runtime layer stack from `./cli/index.js`, and hands execution to
 * `NodeRuntime.runMain`, whose default reporting covers defects (the v3
 * `Cause.defects` wrapper is gone). No type casts: the layer graph is
 * validated by the compiler.
 *
 * @internal
 */
/* v8 ignore start -- bootstrap; commands tested individually */
import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { AppLive, rootCommand } from "./cli/index.js";

/**
 * CLI application: reads argv from the Stdio service provided by NodeServices.
 * (v4's `Command.run` takes only `version` — the name comes from the root command.)
 */
const cli = Command.run(rootCommand, {
	version: process.env.__PACKAGE_VERSION__ ?? "0.0.0",
});

/**
 * Bootstrap and run the `savvy` CLI application.
 */
export const main = (): void => {
	NodeRuntime.runMain(cli.pipe(Effect.provide(AppLive)));
};
/* v8 ignore stop */
