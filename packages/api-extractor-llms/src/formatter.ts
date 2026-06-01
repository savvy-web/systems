// packages/api-extractor-llms/src/formatter.ts
/**
 * Format an API Extractor Excerpt into a clean type signature string. Ported
 * from rspress-plugin-api-extractor's TypeSignatureFormatter. Pure.
 *
 * @packageDocumentation
 */

import type { Excerpt } from "@microsoft/api-extractor-model";

export class TypeSignatureFormatter {
	private readonly maxLineLength: number;
	private readonly indent: string;

	constructor(opts: { maxLineLength?: number; indent?: string } = {}) {
		this.maxLineLength = opts.maxLineLength ?? 80;
		this.indent = opts.indent ?? "  ";
	}

	format(excerpt: Excerpt): string {
		if (!excerpt.spannedTokens || excerpt.spannedTokens.length === 0) {
			return this.stripExportDeclare(excerpt.text);
		}

		const tokens = excerpt.spannedTokens;
		let currentLine = "";
		const lines: string[] = [];
		let bracketDepth = 0;
		let lastTokenText = "";

		for (let i = 0; i < tokens.length; i++) {
			let tokenText = tokens[i].text;
			if (i === 0) tokenText = this.stripExportDeclare(tokenText);
			if (tokenText.trim() === "") continue;

			if (tokenText === "{" || tokenText === "[" || tokenText === "(") bracketDepth++;
			else if (tokenText === "}" || tokenText === "]" || tokenText === ")") bracketDepth--;

			const isOperator = tokenText.trim() === "|" || tokenText.trim() === "&";

			if (lastTokenText && this.needsSpaceBefore(lastTokenText, tokenText)) currentLine += " ";
			currentLine += tokenText;
			lastTokenText = tokenText;

			if (isOperator && bracketDepth === 0 && currentLine.length > this.maxLineLength && i < tokens.length - 1) {
				lines.push(currentLine.trimEnd());
				currentLine = this.indent;
			}
		}
		if (currentLine.trim()) lines.push(currentLine.trimEnd());

		if (lines.length <= 1) {
			let result = "";
			let last = "";
			for (let i = 0; i < tokens.length; i++) {
				let tokenText = tokens[i].text;
				if (i === 0) tokenText = this.stripExportDeclare(tokenText);
				if (tokenText.trim() === "") continue;
				if (last && this.needsSpaceBefore(last, tokenText)) result += " ";
				result += tokenText;
				last = tokenText;
			}
			return result.trimStart();
		}

		return this.stripExportDeclare(lines.join("\n"));
	}

	private stripExportDeclare(text: string): string {
		let result = text
			.trim()
			.replace(/^export\s+declare\s+/i, "")
			.replace(/^export\s+/i, "")
			.replace(/^declare\s+/i, "");
		result = result
			.replace(/\bexport\s+declare\s+/gi, "")
			.replace(/\bexport\s+/gi, "")
			.replace(/\bdeclare\s+/gi, "");
		return result;
	}

	private needsSpaceBefore(prevText: string, currentText: string): boolean {
		if (/\s$/.test(prevText)) return false;
		if (/^\s/.test(currentText)) return false;
		if (currentText.trim().startsWith("<")) return false;
		if (currentText.trim().match(/^[,;]/)) return false;
		if (prevText.trim().endsWith(",")) return true;
		if (currentText.trim() === "=" || currentText.trim().startsWith("=")) return true;
		if (prevText.trim().endsWith("=")) return true;
		if (currentText.trim() === "|" || currentText.trim() === "&") return true;
		if (prevText.trim() === "|" || prevText.trim() === "&") return true;
		if (prevText.trim() === "{" && currentText.trim() !== "}") return true;
		if (currentText.trim() === "}" && prevText.trim() !== "{") return true;
		if (prevText.trim().match(/^[[(]$/)) return false;
		if (currentText.trim().match(/^[\])]$/)) return false;
		if (prevText.trim().endsWith(":")) return true;
		if (prevText.trim().endsWith("?:")) return true;
		if (currentText.trim().startsWith(":") && !prevText.trim().match(/[,;:?]$/)) return false;
		if (currentText.trim().startsWith("{") && /[a-zA-Z0-9_>]$/.test(prevText.trim())) return true;
		const prevEndsAlnum = /[a-zA-Z0-9_>]$/.test(prevText.trim());
		const currStartsAlnum = /^[a-zA-Z0-9_<]/.test(currentText.trim());
		return prevEndsAlnum && currStartsAlnum;
	}
}
