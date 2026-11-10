#!/usr/bin/env node
/**
 * The `savvy` bin. Imports `main` and calls it. Nothing else, ever.
 * @internal
 */
/* v8 ignore start -- bin shim; covered by the silk bins e2e */
// Linked source needs tsx, and a pnpm script loads it through nodeOptions. A direct run of the bin (a git hook, an MCP
// launcher, a bare shell) does not, so it registers tsx here, before anything resolves a sibling's source. A built `.js`
// bin never takes this branch. tsx is the workspace root's alone, and the specifier is computed because rolldown inlines
// a literal, or a const it can fold, into the published package.
if (import.meta.url.endsWith(".ts")) {
	const tsx = ["tsx", "esm", "api"].join("/");
	const { register } = (await import(tsx)) as { readonly register: () => void };
	register();
}

const { main } = await import("./main.js");

main();
/* v8 ignore stop */
