#!/usr/bin/env node
/* v8 ignore start - CLI entry point requires integration testing */
/**
 * GitHub Action Builder CLI entry point.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";

import { AppLayer } from "../layers/app.js";
import { buildCommand, initCommand, validateCommand } from "./commands/index.js";

/**
 * Root command for the CLI.
 */
const rootCommand = Command.make("github-action-builder").pipe(
	Command.withSubcommands([buildCommand, validateCommand, initCommand]),
);

/**
 * CLI application: reads argv from the Stdio service provided by NodeServices.
 */
const cli = Command.run(rootCommand, {
	version: process.env.__PACKAGE_VERSION__ ?? "0.0.0",
});

/**
 * Combined layer: AppLayer + the Node implementations of the CLI
 * environment (FileSystem, Path, Terminal, Stdio, ChildProcessSpawner).
 */
const CliLayer = Layer.mergeAll(AppLayer, NodeServices.layer);

/**
 * Run the CLI.
 *
 * Expected typed errors (ValidationFailed, BuildFailed, etc.) are already
 * printed by command handlers — the failed effect makes the runtime exit
 * non-zero. Usage errors print help via the CLI framework and also fail.
 * NodeRuntime.runMain reports unexpected defects with full cause rendering.
 */
NodeRuntime.runMain(cli.pipe(Effect.provide(CliLayer)));
