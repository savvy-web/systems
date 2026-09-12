#!/usr/bin/env node
/**
 * Binary entrypoint for the `savvy-mcp` server. Owns nothing itself — see
 * `main.ts` for the process bootstrap.
 *
 * @internal
 */
import { main } from "./main.js";

await main();
