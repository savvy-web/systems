#!/usr/bin/env node
/**
 * The `savvy` bin. Imports `main` and calls it. Nothing else, ever.
 * @internal
 */
/* v8 ignore start -- bin shim; covered by the silk bins e2e */
import { main } from "./main.js";

main();
/* v8 ignore stop */
