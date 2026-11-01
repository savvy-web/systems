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

/**
 * Split a command string into its simple commands' word lists. Non-control
 * operator objects (redirections, globs, comments) are dropped, as before.
 */
function simpleCommands(command: string): ReadonlyArray<ReadonlyArray<string>> {
	const segments: string[][] = [];
	let current: string[] = [];
	for (const entry of shellParse(command)) {
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
