#!/usr/bin/env node
/**
 * The `savvy-mcp` bin, provided by the carrier. Mirrors `@savvy-web/mcp`'s own bin: both
 * call the same `main()`. `@savvy-web/silk` is the one package a consumer installs, so
 * it owns this bin entry and `node_modules/.bin/savvy-mcp` is created off that single
 * direct dependency, no hoisting required.
 *
 * This file (with `savvy.ts` beside it) is the ONE sanctioned place silk imports
 * `@savvy-web/mcp`; the repo's non-import invariant otherwise forbids it.
 * @internal
 */
/* v8 ignore start -- bin shim; covered by the built-artifact tests in __test__/externals.test.ts */
import { main } from "@savvy-web/mcp/main";

await main();
/* v8 ignore stop */
