#!/usr/bin/env node
/* v8 ignore start - CLI entry point requires integration testing */
/**
 * GitHub Action Builder CLI entry point.
 */
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect, Layer } from "effect";

import { AppLayer } from "../layers/app.js";
import { buildCommand, initCommand, validateCommand } from "./commands/index.js";

/**
 * Root command for the CLI.
 */
const rootCommand = Command.make("github-action-builder").pipe(
	Command.withSubcommands([buildCommand, validateCommand, initCommand]),
);

/**
 * CLI application configuration.
 */
const cli = Command.run(rootCommand, {
	name: "github-action-builder",
	version: process.env.__PACKAGE_VERSION__ ?? "0.0.0",
});

/**
 * Combined layer: AppLayer + NodeContext for CLI.
 */
const CliLayer = Layer.merge(AppLayer, NodeContext.layer);

/**
 * Run the CLI with full error cause rendering.
 *
 * Expected typed errors (ValidationFailed, BuildFailed, etc.) are already
 * printed by command handlers — they just need to exit with failure.
 * Unexpected defects get full Cause.pretty rendering with stack traces.
 */
const main = Effect.suspend(() => cli(process.argv)).pipe(
	Effect.provide(CliLayer),
	Effect.catchAllCause((cause) => {
		const defects = Cause.defects(cause);
		if (defects.length > 0) {
			return Console.error(Cause.pretty(cause)).pipe(Effect.andThen(Effect.failCause(cause)));
		}
		return Effect.failCause(cause);
	}),
);

NodeRuntime.runMain(main);
