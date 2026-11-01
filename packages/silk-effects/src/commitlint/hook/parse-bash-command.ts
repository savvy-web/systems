/**
 * Parse a Bash command string to extract the commit message and flags
 * for `git commit` / `gh pr create` / `gh pr edit` invocations.
 *
 * @remarks
 * Only enough Bash is parsed to handle the shapes Claude actually emits.
 * Heredocs surface as already-substituted strings inside Claude's tool
 * envelope, so we don't need full shell semantics — just argv tokenization.
 *
 * `shell-quote` returns control operators (`&&`, `||`, `;`, `|`, `&`, and
 * the subshell parentheses) as `{ op }` objects. The command is split on them
 * into simple commands, leading `NAME=value` assignments are dropped from each,
 * and the FIRST simple command that is a `git commit` or `gh pr create`/`edit`
 * is classified. Splitting is what keeps attribution exact: a chained
 * `git add -A && git commit …` is still checked, and a later command's flags
 * (`… && git push --no-verify`) never leak into the commit's. An operator
 * inside quotes is part of a word, never a split point (#856).
 *
 * `shell-quote` reads an unquoted newline as plain whitespace, but to the shell
 * it ends a command just like `;`. {@link separateLines} therefore rewrites
 * each unquoted, unescaped newline outside a `$(…)` to `;` first, joins
 * backslash-continued lines, and drops heredoc bodies, which are input text
 * and never commands.
 *
 * Interim: spencerbeggs/effected#1204 proposes a kit shell-syntax segmenter
 * that would replace `shell-quote` here.
 *
 * @internal
 */
import { parse as shellParse } from "shell-quote";

export type ParsedKind = "git-commit" | "git-commit-amend" | "gh-pr-create" | "gh-pr-edit" | "unknown";

export interface ParsedCommit {
	kind: ParsedKind;
	message: string | null;
	flags: {
		sign: "force-on" | "force-off" | "default";
		noVerify: boolean;
		amend: boolean;
	};
	source: "inline" | "file" | "heredoc" | "stdin" | "none";
}

function emptyFlags(): ParsedCommit["flags"] {
	return { sign: "default", noVerify: false, amend: false };
}

/** Control operators that end one simple command and start the next. */
const CONTROL_OPERATORS: ReadonlySet<string> = new Set(["&&", "||", ";", ";;", "|", "|&", "&", "(", ")"]);

/** A leading shell variable assignment (`NAME=value`), which is not the command name. */
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** A heredoc redirect: `<<` or `<<-`, then an optionally quoted delimiter word. */
const HEREDOC = /^<<(-?)[ \t]*(['"]?)([A-Za-z0-9_.-]+)\2/;

/**
 * Rewrite unquoted newlines to `;` so `shell-quote` sees them as separators.
 *
 * Tracks single quotes, double quotes (with backslash escapes) and `$(…)`
 * nesting outside quotes, and leaves newlines inside any of them alone. A
 * backslash-newline outside quotes is a line continuation and is removed. A
 * heredoc's body, everything after the line that opened it up to its
 * delimiter line, is dropped. Unterminated quotes or heredocs simply run to
 * the end of the string.
 */
function separateLines(command: string): string {
	let out = "";
	let quote: "'" | '"' | null = null;
	let depth = 0;
	const pending: Array<{ readonly delimiter: string; readonly stripTabs: boolean }> = [];
	let i = 0;
	while (i < command.length) {
		const ch = command[i] as string;
		if (quote === "'") {
			out += ch;
			if (ch === "'") quote = null;
			i += 1;
			continue;
		}
		if (quote === '"') {
			if (ch === "\\" && i + 1 < command.length) {
				out += ch + (command[i + 1] as string);
				i += 2;
				continue;
			}
			out += ch;
			if (ch === '"') quote = null;
			i += 1;
			continue;
		}
		if (ch === "\\" && command[i + 1] === "\n") {
			i += 2;
			continue;
		}
		if (ch === "\\" && i + 1 < command.length) {
			out += ch + (command[i + 1] as string);
			i += 2;
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			out += ch;
			i += 1;
			continue;
		}
		if (ch === "$" && command[i + 1] === "(") {
			depth += 1;
			out += "$(";
			i += 2;
			continue;
		}
		if (ch === ")" && depth > 0) {
			depth -= 1;
			out += ch;
			i += 1;
			continue;
		}
		if (ch === "<" && command[i + 1] === "<" && command[i + 2] !== "<") {
			const match = HEREDOC.exec(command.slice(i));
			if (match !== null) {
				pending.push({ delimiter: match[3] as string, stripTabs: match[1] === "-" });
				out += match[0];
				i += match[0].length;
				continue;
			}
		}
		if (ch === "\n") {
			if (pending.length > 0) {
				// Skip each pending heredoc body in order, through its delimiter line.
				let lineStart = i + 1;
				for (const { delimiter, stripTabs } of pending) {
					while (lineStart <= command.length) {
						const lineEnd = command.indexOf("\n", lineStart);
						const end = lineEnd === -1 ? command.length : lineEnd;
						const line = command.slice(lineStart, end);
						lineStart = end + 1;
						if ((stripTabs ? line.replace(/^\t+/, "") : line) === delimiter) break;
					}
				}
				pending.length = 0;
				// Inside `$(…)` a heredoc ends the line but not the command.
				out += depth > 0 ? "\n" : " ; ";
				i = lineStart - 1;
				if (i >= command.length) break;
				// `i` now points at the newline ending the delimiter line; consume it.
				i += 1;
				continue;
			}
			out += depth > 0 ? ch : " ; ";
			i += 1;
			continue;
		}
		out += ch;
		i += 1;
	}
	return out;
}

/**
 * Split a command string into its simple commands' word lists. Non-control
 * operator objects (redirections, globs, comments) are dropped, as before.
 */
function simpleCommands(command: string): ReadonlyArray<ReadonlyArray<string>> {
	const segments: string[][] = [];
	let current: string[] = [];
	for (const entry of shellParse(separateLines(command))) {
		if (typeof entry === "string") {
			current.push(entry);
		} else if ("op" in entry && CONTROL_OPERATORS.has(entry.op)) {
			if (current.length > 0) segments.push(current);
			current = [];
		}
	}
	if (current.length > 0) segments.push(current);
	return segments.map((words) => {
		let start = 0;
		while (start < words.length && ASSIGNMENT.test(words[start] ?? "")) start += 1;
		return words.slice(start);
	});
}

export function parseBashCommand(command: string): ParsedCommit {
	for (const tokens of simpleCommands(command)) {
		const parsed = classify(tokens);
		if (parsed.kind !== "unknown") return parsed;
	}
	return { kind: "unknown", message: null, flags: emptyFlags(), source: "none" };
}

function classify(tokens: ReadonlyArray<string>): ParsedCommit {
	if (tokens.length === 0) return { kind: "unknown", message: null, flags: emptyFlags(), source: "none" };

	if (tokens[0] === "git" && tokens[1] === "commit") {
		const flags = extractGitCommitFlags(tokens);
		const kind: ParsedKind = flags.amend ? "git-commit-amend" : "git-commit";
		const message = extractGitCommitMessage(tokens);
		return { kind, message, flags, source: message === null ? "none" : "inline" };
	}

	if (tokens[0] === "gh" && tokens[1] === "pr" && (tokens[2] === "create" || tokens[2] === "edit")) {
		const kind: ParsedKind = tokens[2] === "create" ? "gh-pr-create" : "gh-pr-edit";
		const message = extractFlagValue(tokens, "--body", "-b");
		return {
			kind,
			message,
			flags: emptyFlags(),
			source: message === null ? "none" : "inline",
		};
	}

	return { kind: "unknown", message: null, flags: emptyFlags(), source: "none" };
}

function extractGitCommitFlags(tokens: ReadonlyArray<string>): ParsedCommit["flags"] {
	let sign: ParsedCommit["flags"]["sign"] = "default";
	let noVerify = false;
	let amend = false;
	for (const tok of tokens.slice(2)) {
		if (tok === "-S" || tok === "--gpg-sign" || tok.startsWith("--gpg-sign=")) sign = "force-on";
		else if (tok === "--no-gpg-sign") sign = "force-off";
		else if (tok === "--no-verify" || tok === "-n") noVerify = true;
		else if (tok === "--amend") amend = true;
	}
	return { sign, noVerify, amend };
}

function extractGitCommitMessage(tokens: ReadonlyArray<string>): string | null {
	const parts: string[] = [];
	for (let i = 2; i < tokens.length; i++) {
		const tok = tokens[i];
		if (tok === undefined) continue;
		if (tok === "-m" || tok === "--message") {
			const next = tokens[i + 1];
			if (next !== undefined) {
				parts.push(next);
				i += 1;
			}
		} else if (tok.startsWith("--message=")) {
			parts.push(tok.slice("--message=".length));
		}
	}
	return parts.length > 0 ? parts.join("\n\n") : null;
}

function extractFlagValue(tokens: ReadonlyArray<string>, ...names: string[]): string | null {
	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if (tok === undefined) continue;
		if (names.includes(tok)) return tokens[i + 1] ?? null;
		for (const name of names) {
			if (tok.startsWith(`${name}=`)) return tok.slice(name.length + 1);
		}
	}
	return null;
}
