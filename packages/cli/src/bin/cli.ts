#!/usr/bin/env node
/**
 * Binary entry point for the `savvy` CLI.
 *
 * This file is the `bin` target in `package.json`. It delegates immediately
 * to {@link runCli} which assembles the `\@effect/cli` command tree and
 * executes it via `\@effect/platform-node`.
 *
 * @internal
 */
/* v8 ignore start -- CLI bootstrap; commands tested individually */
import { runCli } from "../cli/index.js";

runCli();
/* v8 ignore stop */
