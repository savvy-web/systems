#!/usr/bin/env node
/**
 * The `savvy` bin, provided by the carrier. Mirrors `@savvy-web/cli`'s own bin: both
 * call the same `main()`. `@savvy-web/silk` is the one package a consumer installs, so
 * it owns this bin entry and `node_modules/.bin/savvy` is created off that single direct
 * dependency, no hoisting required.
 *
 * This file (with `savvy-mcp.ts` beside it) is the ONE sanctioned place silk imports
 * `@savvy-web/cli`; the repo's non-import invariant otherwise forbids it.
 * @internal
 */
/* v8 ignore start -- bin shim; covered by the built-artifact tests in __test__/externals.test.ts */
// Linked source needs tsx, and a pnpm script loads it through nodeOptions. A direct run of the bin (a git hook, an MCP
// launcher, a bare shell) does not, so it registers tsx here, before anything resolves a sibling's source. A built `.js`
// bin never takes this branch. tsx is the workspace root's alone, and the specifier is computed because rolldown inlines
// a literal, or a const it can fold, into the published package.
if (import.meta.url.endsWith(".ts")) {
	const tsx = ["tsx", "esm", "api"].join("/");
	const { register } = (await import(tsx)) as { readonly register: () => void };
	register();
}

const { main } = await import("@savvy-web/cli/main");

// The build defines `process.env.__PACKAGE_VERSION__` per package, so this is silk's own version.
main({ distribution: { name: "@savvy-web/silk", version: process.env.__PACKAGE_VERSION__ ?? "0.0.0" } });
/* v8 ignore stop */
