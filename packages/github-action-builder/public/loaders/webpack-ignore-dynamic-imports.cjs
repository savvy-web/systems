"use strict";

/**
 * rspack loader that injects the `webpackIgnore` magic comment into dynamic
 * `import(...)` calls whose argument is not a string literal (or is a
 * template literal that isn't fully static).
 *
 * @remarks
 * rspack compiles a fully dynamic `import(expr)` (an argument it cannot
 * statically resolve to a literal path) into a "context module" — a stub
 * that globs a directory at build time and throws `Cannot find module` at
 * runtime for any path it didn't see, even when the real file exists on
 * disk. Some third-party packages (e.g. `@changesets/apply-release-plan`)
 * resolve a module path at runtime and dynamically import it; bundling that
 * call as a context module breaks it. The same is true of an *interpolated*
 * template literal — `` import(`./x/${y}.js`) `` compiles to the same
 * context-module stub as a bare identifier, because rspack cannot statically
 * resolve the interpolated segment either.
 *
 * rspack (like webpack) respects a `/* webpackIgnore: true *\/` comment
 * immediately inside the `import(` call — it skips context-module analysis
 * for that call and leaves a plain, native, runtime `import()` in the
 * output. This loader is a pure string transform (no AST parsing, so no
 * source-map chaining — the returned source is treated as a 1:1 replacement
 * and any pre-existing source map for this file is not remapped) that runs
 * in two passes:
 *
 * 1. Inject the comment into any `import(` call whose argument is not a
 *    string literal, not a backtick template literal (handled in pass 2),
 *    and does not already carry a `webpackIgnore` magic comment. A
 *    *different* leading magic comment (e.g. `webpackChunkName`) does not
 *    suppress injection — the ignore comment is prepended alongside it, so
 *    both survive: `import(/* webpackIgnore: true *\/ /* webpackChunkName:
 *    "x" *\/ ident)`.
 * 2. Inject the comment into a backtick template-literal argument, but only
 *    when it contains `${` interpolation. A fully static template literal
 *    (e.g. `` import(`./static.js`) ``) compiles to a literal path just like
 *    a plain string, so it is left untouched. Finding the template
 *    literal's closing backtick is a pragmatic linear scan (skipping
 *    backslash-escaped characters), not a real parser: it does not track
 *    nested template literals inside an interpolation (e.g.
 *    `` import(`${`nested`}`) ``) and will stop at the first unescaped
 *    backtick it sees, which is a documented limitation of this non-AST
 *    heuristic.
 *
 * Deliberately skipped (left untouched):
 * - `import("./static.js")` — a string-literal import; the bundler already
 *   resolves and bundles these correctly, no need to touch them.
 * - `` import(`./static.js`) `` — a fully static template literal; same
 *   reasoning as a plain string (see pass 2 above).
 * - `import(/* webpackIgnore: true *\/ x)` — already has the comment
 *   injected (idempotent: running this loader twice must not double-inject).
 * - `important(x)` — the `\b` word-boundary guard on `import` prevents
 *   matching inside a longer identifier.
 *
 * This file is shipped as a genuine on-disk `.cjs` file (not bundled away)
 * because rspack loaders are loaded via `require()` at build time — see
 * `public/` in this package's `package.json`, which is copied verbatim to
 * the package root by the build (so this ships at `<pkg>/loaders/
 * webpack-ignore-dynamic-imports.cjs`, not under a `public/` prefix).
 *
 * @param source - The original module source text.
 * @returns The source text with `webpackIgnore` comments injected into
 * every fully-dynamic `import(` call.
 */
module.exports = function webpackIgnoreDynamicImportsLoader(source) {
	// Pass 1: string-literal and backtick arguments are excluded from this
	// pass (the former never needs the comment; the latter is handled by
	// pass 2 below). An optional single leading `/* ... */` magic comment is
	// captured so it can be inspected: if it already contains
	// `webpackIgnore`, the call is left untouched (idempotent); otherwise the
	// new comment is prepended ahead of it.
	let result = source.replace(/\bimport\s*\(\s*(\/\*[\s\S]*?\*\/\s*)?(?!["'`])/g, (match, existingComment) => {
		if (existingComment && /webpackIgnore/.test(existingComment)) {
			return match;
		}
		return match.replace("(", "(/* webpackIgnore: true */ ");
	});

	// Pass 2: backtick template-literal arguments. Only interpolated
	// template literals (containing `${`) need the comment; a fully static
	// one is left untouched.
	result = result.replace(/\bimport\s*\(\s*`/g, (match, offset, full) => {
		const backtickIndex = offset + match.length - 1;
		let end = backtickIndex + 1;
		while (end < full.length && full[end] !== "`") {
			if (full[end] === "\\") {
				end++;
			}
			end++;
		}
		const literal = full.slice(backtickIndex, end + 1);
		if (!literal.includes("${")) {
			return match;
		}
		return match.replace(/`$/, "/* webpackIgnore: true */ `");
	});

	return result;
};
