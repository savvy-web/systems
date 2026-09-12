/**
 * The scanner behind `boundaries.test.ts` — the L1 gate that keeps
 * `@savvy-web/silk-core` platform-free.
 *
 * A regex over raw source has two blind spots: a `process` mention inside a
 * string or comment is a false positive, and `process["env"]` or a
 * destructuring read is a false negative. This module tokenizes just enough
 * TypeScript to separate code from comments, string/template/regex literals,
 * then answers the two questions the gate asks: which module specifiers a
 * file names (in any import/export/require form), and whether it touches the
 * `process` identifier.
 */

import { builtinModules } from "node:module";

/** One lexical run of the source. */
export interface Token {
	readonly kind: "code" | "comment" | "string" | "template" | "regex";
	readonly text: string;
}

const isIdentChar = (ch: string): boolean => /[\p{L}\p{N}_$]/u.test(ch);

/**
 * Whether a `/` at this point starts a regex literal rather than a division.
 * Heuristic: division follows a value (identifier, number, `)`, `]`, or a
 * closing template/string); a regex follows anything else.
 */
const regexAllowedAfter = (code: string): boolean => {
	const trimmed = code.trimEnd();
	if (trimmed.length === 0) return true;
	const last = trimmed[trimmed.length - 1] as string;
	if (last === ")" || last === "]" || last === "}") return false;
	if (isIdentChar(last)) {
		const word = trimmed.match(/[\p{L}\p{N}_$]+$/u)?.[0] ?? "";
		return ["return", "typeof", "case", "do", "else", "in", "of", "yield", "await", "void", "delete", "throw"].includes(
			word,
		);
	}
	return true;
};

/**
 * Split TypeScript source into code, comment, string, template and regex
 * tokens. Template `${ … }` expressions are emitted as `code` tokens (nested
 * templates included), so a `process` read inside an interpolation is still
 * visible to the scan.
 */
export const tokenize = (source: string): ReadonlyArray<Token> => {
	const tokens: Array<Token> = [];
	let code = "";
	let i = 0;
	const flushCode = (): void => {
		if (code.length > 0) tokens.push({ kind: "code", text: code });
		code = "";
	};
	// Each entry is the brace depth at which the enclosing template resumes.
	const templateStack: Array<number> = [];
	let braceDepth = 0;

	const readTemplate = (): void => {
		// Called with i just past the opening backtick or closing `}` of an expression.
		let text = "";
		while (i < source.length) {
			const ch = source[i] as string;
			if (ch === "\\") {
				text += ch + (source[i + 1] ?? "");
				i += 2;
				continue;
			}
			if (ch === "`") {
				i += 1;
				tokens.push({ kind: "template", text });
				return;
			}
			if (ch === "$" && source[i + 1] === "{") {
				tokens.push({ kind: "template", text });
				templateStack.push(braceDepth);
				braceDepth += 1;
				i += 2;
				return;
			}
			text += ch;
			i += 1;
		}
		tokens.push({ kind: "template", text });
	};

	while (i < source.length) {
		const ch = source[i] as string;
		const next = source[i + 1];
		if (ch === "/" && next === "/") {
			flushCode();
			const end = source.indexOf("\n", i);
			const stop = end === -1 ? source.length : end;
			tokens.push({ kind: "comment", text: source.slice(i, stop) });
			i = stop;
			continue;
		}
		if (ch === "/" && next === "*") {
			flushCode();
			const end = source.indexOf("*/", i + 2);
			const stop = end === -1 ? source.length : end + 2;
			tokens.push({ kind: "comment", text: source.slice(i, stop) });
			i = stop;
			continue;
		}
		if (ch === '"' || ch === "'") {
			flushCode();
			let j = i + 1;
			while (j < source.length && source[j] !== ch && source[j] !== "\n") {
				if (source[j] === "\\") j += 1;
				j += 1;
			}
			tokens.push({ kind: "string", text: source.slice(i, j + 1) });
			i = j + 1;
			continue;
		}
		if (ch === "`") {
			flushCode();
			i += 1;
			readTemplate();
			continue;
		}
		if (ch === "{") {
			braceDepth += 1;
			code += ch;
			i += 1;
			continue;
		}
		if (ch === "}") {
			const resume = templateStack[templateStack.length - 1];
			if (resume !== undefined && braceDepth - 1 === resume) {
				templateStack.pop();
				braceDepth -= 1;
				flushCode();
				i += 1;
				readTemplate();
				continue;
			}
			braceDepth -= 1;
			code += ch;
			i += 1;
			continue;
		}
		if (ch === "/" && regexAllowedAfter(code)) {
			let j = i + 1;
			let inClass = false;
			while (j < source.length && source[j] !== "\n") {
				const c = source[j] as string;
				if (c === "\\") {
					j += 2;
					continue;
				}
				if (c === "[") inClass = true;
				else if (c === "]") inClass = false;
				else if (c === "/" && !inClass) break;
				j += 1;
			}
			if (source[j] === "/") {
				flushCode();
				let k = j + 1;
				while (k < source.length && /[a-z]/.test(source[k] as string)) k += 1;
				tokens.push({ kind: "regex", text: source.slice(i, k) });
				i = k;
				continue;
			}
		}
		code += ch;
		i += 1;
	}
	flushCode();
	return tokens;
};

/** Source with every comment removed; literals are kept (module specifiers are strings). */
export const stripComments = (source: string): string =>
	tokenize(source)
		.filter((t) => t.kind !== "comment")
		.map((t) => (t.kind === "string" ? t.text : t.kind === "template" ? `\`${t.text}\`` : t.text))
		.join("");

/** Only the code tokens: comments and string/template/regex literal bodies are gone. */
export const stripNonCode = (source: string): string =>
	tokenize(source)
		.map((t) => (t.kind === "code" ? t.text : t.kind === "string" ? `${t.text[0]}${t.text[0]}` : " "))
		.join("");

const SPECIFIER_FORMS: ReadonlyArray<RegExp> = [
	// import … from "x" / import type … from "x"
	/\bimport\s+(?:type\s+)?[^;'"]*?\bfrom\s*["']([^"']+)["']/g,
	// import "x"
	/\bimport\s*["']([^"']+)["']/g,
	// export … from "x" / export * as ns from "x" / export type … from "x"
	/\bexport\s+(?:type\s+)?[^;'"]*?\bfrom\s*["']([^"']+)["']/g,
	// import("x")
	/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
	// require("x")
	/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

/** Code plus plain string literals — the only place a module specifier can live. */
const codeAndStrings = (source: string): string =>
	tokenize(source)
		.map((t) => (t.kind === "code" || t.kind === "string" ? t.text : " "))
		.join("");

/**
 * Every module specifier the source names, in any import/export/require form.
 * Comments, template text and regex bodies are ignored.
 */
export const extractSpecifiers = (source: string): ReadonlyArray<string> => {
	const code = codeAndStrings(source);
	const found = new Set<string>();
	for (const form of SPECIFIER_FORMS) {
		for (const match of code.matchAll(form)) found.add(match[1] as string);
	}
	return [...found];
};

const BUILTINS: ReadonlySet<string> = new Set(builtinModules);

/**
 * Whether a specifier reaches the platform: a `node:` module, a bare Node
 * builtin (`fs`, `fs/promises`, `process`), `@effect/platform*`, or
 * `effect/unstable/process`.
 */
export const isForbiddenSpecifier = (specifier: string): boolean =>
	specifier.startsWith("node:") ||
	BUILTINS.has(specifier) ||
	BUILTINS.has(specifier.split("/")[0] as string) ||
	specifier === "process" ||
	specifier.startsWith("@effect/platform") ||
	specifier === "effect/unstable/process" ||
	specifier.startsWith("effect/unstable/process/");

/** Forbidden specifiers the source names. */
export const forbiddenSpecifiers = (source: string): ReadonlyArray<string> =>
	extractSpecifiers(source).filter(isForbiddenSpecifier);

/**
 * Whether the source touches the `process` identifier in code — a member read
 * (`process.env`, `process["env"]`), a destructuring (`const { env } = process`),
 * a bare pass-through, an interpolation, or the global reached through
 * `globalThis.process` / `global.process`. A property named `process` on any
 * other object (`foo.process`) is not the global and is not flagged; neither is
 * a mention inside a string, template text, regex or comment.
 */
export const readsProcess = (source: string): boolean =>
	/(?:(?<![\p{L}\p{N}_$.])|(?<=\bglobal(?:This)?\s*\.\s*))process(?![\p{L}\p{N}_$])/u.test(stripNonCode(source));
