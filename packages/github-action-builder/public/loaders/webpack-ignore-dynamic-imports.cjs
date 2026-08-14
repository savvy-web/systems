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
 * output. This loader is a string transform (no AST parsing, so no
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
 * Both passes are gated by a lexical scan of their input: any `import(`
 * whose keyword sits inside a line comment, block comment, string literal,
 * template-literal text, or regex literal is left untouched. Without that
 * gate a doc comment that merely *mentions* `import(...)` got the block
 * comment injected into it, and the injected `*\/` closed the enclosing
 * comment early — spilling the comment remainder into the token stream as a
 * syntax error (savvy-web/systems#412). The scan is a lexer, not a parser:
 * regex-vs-division at a `/` is decided by the standard
 * preceding-token heuristic (identifier/`)`/`]` → division, unless the
 * identifier is a keyword like `return` or `typeof` → regex), which can
 * misread pathological code such as `if (x) /re/.test(s)` — acceptable for
 * the bundled-package sources this loader sees.
 *
 * Deliberately skipped (left untouched):
 * - `import("./static.js")` — a string-literal import; the bundler already
 *   resolves and bundles these correctly, no need to touch them.
 * - `` import(`./static.js`) `` — a fully static template literal; same
 *   reasoning as a plain string (see pass 2 above).
 * - `import()` — an empty argument list is never a resolvable dynamic
 *   import, so there is nothing to preserve (this is the prose form doc
 *   comments overwhelmingly use, so it is also excluded by the lookahead as
 *   defense in depth alongside the lexical gate).
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
 */

/**
 * Keywords after which a `/` starts a regex literal rather than division,
 * even though the preceding character is an identifier character.
 */
const REGEX_PRECEDING_KEYWORDS = new Set([
	"await",
	"case",
	"delete",
	"do",
	"else",
	"in",
	"instanceof",
	"new",
	"of",
	"return",
	"throw",
	"typeof",
	"void",
	"yield",
]);

const WORD_CHAR = /[$\w]/;

/**
 * Lexically scans JS source and returns the sorted `[start, end)` ranges of
 * every region where an `import(` occurrence is NOT a dynamic import call:
 * line comments, block comments, string literals, template-literal text
 * (interpolation code is deliberately left unprotected — a real dynamic
 * import can live inside `${ ... }`), and regex literals.
 *
 * @param {string} source - The module source text.
 * @returns {Array<[number, number]>} Sorted, non-overlapping ranges.
 */
function computeProtectedRanges(source) {
	const ranges = [];
	// Brace-depth counters for template literals whose `${` interpolation we
	// are currently inside; the top of the stack tracks the innermost one.
	const templateStack = [];
	// Last significant character and trailing identifier word seen in code
	// state — the standard regex-vs-division heuristic input.
	let lastCode = "";
	let lastWord = "";
	const len = source.length;
	let i = 0;

	/**
	 * Scans template-literal text starting at the opening backtick or at a
	 * `}` resuming an interrupted template. Pushes the protected text range
	 * and returns the index to continue from (inside interpolation code or
	 * after the closing backtick).
	 *
	 * @param {number} start - Index of the backtick or resuming `}`.
	 * @returns {number} Index to continue scanning from.
	 */
	const scanTemplateText = (start) => {
		let j = start + 1;
		while (j < len) {
			const c = source[j];
			if (c === "\\") {
				j += 2;
				continue;
			}
			if (c === "`") {
				ranges.push([start, j + 1]);
				return j + 1;
			}
			if (c === "$" && source[j + 1] === "{") {
				ranges.push([start, j + 2]);
				templateStack.push(0);
				return j + 2;
			}
			j++;
		}
		ranges.push([start, len]);
		return len;
	};

	while (i < len) {
		const ch = source[i];
		const next = source[i + 1];
		if (ch === "/" && next === "/") {
			const start = i;
			i += 2;
			while (i < len && source[i] !== "\n") {
				i++;
			}
			ranges.push([start, i]);
			continue;
		}
		if (ch === "/" && next === "*") {
			const start = i;
			i += 2;
			while (i < len && !(source[i] === "*" && source[i + 1] === "/")) {
				i++;
			}
			i = Math.min(i + 2, len);
			ranges.push([start, i]);
			continue;
		}
		if (ch === '"' || ch === "'") {
			const start = i;
			i++;
			while (i < len && source[i] !== ch && source[i] !== "\n") {
				if (source[i] === "\\") {
					i++;
				}
				i++;
			}
			i++;
			ranges.push([start, Math.min(i, len)]);
			lastCode = ")";
			lastWord = "";
			continue;
		}
		if (ch === "`") {
			i = scanTemplateText(i);
			lastCode = ")";
			lastWord = "";
			continue;
		}
		if (ch === "/") {
			// Regex literal vs division: regex unless the previous significant
			// token can end an expression.
			const afterWord = WORD_CHAR.test(lastCode);
			const isDivision =
				lastCode !== "" &&
				((afterWord && !REGEX_PRECEDING_KEYWORDS.has(lastWord)) || lastCode === ")" || lastCode === "]");
			if (isDivision) {
				lastCode = ch;
				lastWord = "";
				i++;
				continue;
			}
			const start = i;
			i++;
			let inClass = false;
			while (i < len) {
				const c = source[i];
				if (c === "\\") {
					i += 2;
					continue;
				}
				if (c === "\n") {
					break;
				}
				if (c === "[") {
					inClass = true;
				} else if (c === "]") {
					inClass = false;
				} else if (c === "/" && !inClass) {
					i++;
					break;
				}
				i++;
			}
			ranges.push([start, Math.min(i, len)]);
			lastCode = ")";
			lastWord = "";
			continue;
		}
		if (templateStack.length > 0) {
			if (ch === "{") {
				templateStack[templateStack.length - 1]++;
			} else if (ch === "}") {
				if (templateStack[templateStack.length - 1] === 0) {
					templateStack.pop();
					i = scanTemplateText(i);
					lastCode = ")";
					lastWord = "";
					continue;
				}
				templateStack[templateStack.length - 1]--;
			}
		}
		if (!/\s/.test(ch)) {
			lastWord = WORD_CHAR.test(ch) ? (WORD_CHAR.test(lastCode) ? lastWord + ch : ch) : "";
			lastCode = ch;
		}
		i++;
	}
	return ranges;
}

/**
 * Whether `offset` falls inside any of the sorted protected `ranges`.
 *
 * @param {Array<[number, number]>} ranges - Output of {@link computeProtectedRanges}.
 * @param {number} offset - Candidate match offset.
 * @returns {boolean} True when the offset is protected.
 */
function isProtected(ranges, offset) {
	for (const [start, end] of ranges) {
		if (offset < start) {
			return false;
		}
		if (offset < end) {
			return true;
		}
	}
	return false;
}

/**
 * The rspack loader entry point — see the file overview above for the full
 * transform contract.
 *
 * @param {string} source - The original module source text.
 * @returns {string} The source text with `webpackIgnore` comments injected
 * into every fully-dynamic `import(` call.
 */
module.exports = function webpackIgnoreDynamicImportsLoader(source) {
	// Pass 1: string-literal and backtick arguments are excluded from this
	// pass (the former never needs the comment; the latter is handled by
	// pass 2 below), as is an empty argument list — `import()` is prose, not
	// a resolvable import. An optional single leading `/* ... */` magic
	// comment is captured so it can be inspected: if it already contains
	// `webpackIgnore`, the call is left untouched (idempotent); otherwise the
	// new comment is prepended ahead of it. Matches whose `import` keyword
	// sits in a protected lexical region (comment/string/template-text/regex)
	// are skipped.
	let ranges = computeProtectedRanges(source);
	let result = source.replace(/\bimport\s*\(\s*(\/\*[\s\S]*?\*\/\s*)?(?!["'`)])/g, (match, existingComment, offset) => {
		if (isProtected(ranges, offset)) {
			return match;
		}
		if (existingComment && /webpackIgnore/.test(existingComment)) {
			return match;
		}
		return match.replace("(", "(/* webpackIgnore: true */ ");
	});

	// Pass 2: backtick template-literal arguments. Only interpolated
	// template literals (containing `${`) need the comment; a fully static
	// one is left untouched. Re-scan the pass-1 output — offsets shifted.
	ranges = computeProtectedRanges(result);
	result = result.replace(/\bimport\s*\(\s*`/g, (match, offset, full) => {
		if (isProtected(ranges, offset)) {
			return match;
		}
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
