/**
 * Handler for grep-visible text files.
 *
 * Fails when a tracked source file is not plain UTF-8 text that grep and
 * ripgrep will search (savvy-web/systems#388).
 */

import type { GitCommandError, NotARepositoryError, UnknownRefError } from "@effected/git";
import { Git } from "@effected/git";
import type { PlatformError } from "effect";
import { Data, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { LintStagedHandler, TextFilesListOptions, TextFilesOptions } from "../types.js";
import { Command } from "../utils/Command.js";
import { Filter } from "../utils/Filter.js";

/**
 * Why a file is not grep-visible text.
 *
 * @remarks
 * `"nul"` — the file contains a NUL byte, which ripgrep (anywhere) and
 * `git grep -I` (first 8000 bytes) take as the mark of a binary file and
 * silently skip. `"invalid-utf8"` — the bytes are not well-formed UTF-8.
 *
 * @public
 */
export const TextFileViolationReason = Schema.Literals(["nul", "invalid-utf8"]);
/** @public */
export type TextFileViolationReason = typeof TextFileViolationReason.Type;

/**
 * The first occurrence of one {@link TextFileViolationReason} in a byte buffer.
 *
 * @remarks
 * `offset` is the 0-based byte offset of the offending byte (for
 * `"invalid-utf8"`, the first byte of the ill-formed sequence). `line` is
 * 1-based and unambiguous even in invalid input: LF never occurs inside a
 * multi-byte UTF-8 sequence. `column` is the 1-based character column,
 * counting code points on the line before the offset (a leading BOM is not
 * counted); when the line prefix itself holds invalid bytes it is an
 * approximation, and `offset` is the exact position.
 *
 * @public
 */
export class TextFileViolation extends Schema.Class<TextFileViolation>("TextFileViolation")({
	reason: TextFileViolationReason,
	offset: Schema.Number,
	line: Schema.Number,
	column: Schema.Number,
}) {}

/**
 * A {@link TextFileViolation} found in a named file.
 *
 * @public
 */
export class TextFileFinding extends Schema.Class<TextFileFinding>("TextFileFinding")({
	path: Schema.String,
	reason: TextFileViolationReason,
	offset: Schema.Number,
	line: Schema.Number,
	column: Schema.Number,
}) {
	/** `path:line:column`, the form editors and terminals turn into a link. */
	get location(): string {
		return `${this.path}:${this.line}:${this.column}`;
	}

	/** A one-line explanation with the mechanical fix. */
	get message(): string {
		return this.reason === "nul"
			? "contains a NUL byte — write it as the \\0 escape so grep and ripgrep do not skip the file"
			: `is not valid UTF-8 (byte offset ${this.offset}) — re-encode the file as UTF-8`;
	}
}

/**
 * Base of {@link TextFileStagedReadError}, exported so downstream declaration
 * emit can name it (an unexported `Data.TaggedError` base fails TS4023 in any
 * package whose inferred types carry the error).
 *
 * @internal
 */
export const TextFileStagedReadErrorBase = Data.TaggedError("TextFileStagedReadError");

/**
 * A file's staged (index) content could not be read.
 *
 * @remarks
 * Raised by {@link TextFiles.readStaged} when `git cat-file` exits non-zero —
 * typically because the path has no stage-0 index entry (never added, or
 * mid-merge), or the directory is not inside a git repository.
 *
 * @public
 */
export class TextFileStagedReadError extends TextFileStagedReadErrorBase<{
	readonly path: string;
	readonly exitCode: number;
	readonly stderr: string;
}> {
	get message(): string {
		const detail = this.stderr.trim();
		return `cannot read the staged content of ${this.path} (git cat-file exited ${this.exitCode})${detail ? `: ${detail}` : ""}`;
	}
}

/**
 * The outcome of {@link TextFiles.checkStagedFiles}: the findings in every
 * staged blob that could be read, and a read error for each file that could
 * not.
 *
 * @remarks
 * An unreadable file does not stop the check: every other file is still read
 * and classified, so one path without an index entry cannot hide a finding
 * elsewhere. Both arrays keep the input order.
 *
 * @public
 */
export interface TextFileStagedCheck {
	/** One finding per violation across the readable files. */
	readonly findings: ReadonlyArray<TextFileFinding>;
	/** One error per file whose staged content could not be read. */
	readonly unreadable: ReadonlyArray<TextFileStagedReadError>;
}

/**
 * The 0-based offset of the first byte of the first ill-formed UTF-8
 * sequence, or `-1` when the buffer is well-formed.
 *
 * Follows the Unicode well-formed byte-sequence table (Unicode Standard,
 * Table 3-7), which is exactly what a fatal `TextDecoder("utf-8")` accepts:
 * overlong forms, encoded surrogates, code points past U+10FFFF, stray
 * continuation bytes and truncated sequences are all ill-formed.
 */
const firstInvalidUtf8 = (bytes: Uint8Array): number => {
	const n = bytes.length;
	let i = 0;
	while (i < n) {
		const lead = bytes[i] as number;
		if (lead < 0x80) {
			i++;
			continue;
		}
		let length: number;
		let lo = 0x80;
		let hi = 0xbf;
		if (lead >= 0xc2 && lead <= 0xdf) {
			length = 2;
		} else if (lead === 0xe0) {
			length = 3;
			lo = 0xa0;
		} else if (lead === 0xed) {
			length = 3;
			hi = 0x9f;
		} else if (lead >= 0xe1 && lead <= 0xef) {
			length = 3;
		} else if (lead === 0xf0) {
			length = 4;
			lo = 0x90;
		} else if (lead === 0xf4) {
			length = 4;
			hi = 0x8f;
		} else if (lead >= 0xf1 && lead <= 0xf3) {
			length = 4;
		} else {
			return i;
		}
		if (i + length > n) return i;
		const second = bytes[i + 1] as number;
		if (second < lo || second > hi) return i;
		for (let k = 2; k < length; k++) {
			const next = bytes[i + k] as number;
			if (next < 0x80 || next > 0xbf) return i;
		}
		i += length;
	}
	return -1;
};

const hasBom = (bytes: Uint8Array): boolean =>
	bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

/** Build the violation for `offset`, resolving its line and character column. */
const locate = (bytes: Uint8Array, reason: TextFileViolationReason, offset: number): TextFileViolation => {
	let line = 1;
	let lineStart = 0;
	for (let i = 0; i < offset; i++) {
		if (bytes[i] === 0x0a) {
			line++;
			lineStart = i + 1;
		}
	}
	if (lineStart === 0 && hasBom(bytes) && offset >= 3) lineStart = 3;
	// Count code points: every byte that is not a continuation byte starts one.
	let column = 1;
	for (let i = lineStart; i < offset; i++) {
		if (((bytes[i] as number) & 0xc0) !== 0x80) column++;
	}
	return TextFileViolation.make({ reason, offset, line, column });
};

/**
 * Handler for grep-visible text files.
 *
 * Fails a commit when a staged source file contains a NUL byte or is not
 * valid UTF-8 — the two ways a text file becomes invisible to `grep`/`rg`,
 * which then return false negatives instead of an error.
 *
 * @remarks
 * The check is read-only, so its glob may overlap the Biome `--write` key
 * without a staging conflict. The lint-staged handler shells out to
 * `savvy lint text --staged <files>` (reading the index, not the worktree),
 * the same command `savvy lint text` runs with no
 * arguments over every git-tracked file matching {@link TextFiles.glob}. The
 * fix is always mechanical: write `\0` as an escape, never a literal NUL.
 *
 * @example
 * ```typescript
 * import { TextFiles } from '\@savvy-web/silk/lint';
 *
 * export default {
 *   [TextFiles.glob]: TextFiles.create({ exclude: ['vendor/'] }),
 * };
 * ```
 *
 * @public
 */
export class TextFiles {
	/**
	 * File extensions checked: source, config, docs and shell text.
	 */
	static readonly extensions = [
		"ts",
		"tsx",
		"mts",
		"cts",
		"js",
		"jsx",
		"mjs",
		"cjs",
		"json",
		"jsonc",
		"md",
		"mdx",
		"yml",
		"yaml",
		"toml",
		"css",
		"sh",
		"bats",
	] as const;

	/**
	 * Glob pattern for matching checked files, derived from {@link TextFiles.extensions}.
	 * @defaultValue `'**\/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,json,jsonc,md,mdx,yml,yaml,toml,css,sh,bats}'`
	 */
	static readonly glob: string = `**/*.{${TextFiles.extensions.join(",")}}`;

	/**
	 * Default patterns to exclude from checking.
	 * @defaultValue `[]`
	 */
	static readonly defaultExcludes = [] as const;

	/**
	 * Pre-configured handler with default options.
	 */
	static readonly handler: LintStagedHandler = TextFiles.create();

	/**
	 * Whether `path` has one of the checked {@link TextFiles.extensions}.
	 *
	 * @param path - A file path
	 * @returns `true` when the file is in scope
	 */
	static matches(path: string): boolean {
		return TextFiles.extensions.some((ext) => path.endsWith(`.${ext}`));
	}

	/**
	 * Classify a file's bytes.
	 *
	 * @remarks
	 * Pure. Returns the first NUL byte and the first ill-formed UTF-8 sequence,
	 * each at most once, ordered by offset; an empty array means the bytes are
	 * grep-visible text. A UTF-8 BOM is valid, and an empty buffer passes.
	 *
	 * @param bytes - The file contents
	 * @returns The violations found, empty when none
	 */
	static classify(bytes: Uint8Array): ReadonlyArray<TextFileViolation> {
		const violations: Array<TextFileViolation> = [];
		const invalid = firstInvalidUtf8(bytes);
		if (invalid >= 0) violations.push(locate(bytes, "invalid-utf8", invalid));
		const nul = bytes.indexOf(0);
		if (nul >= 0) violations.push(locate(bytes, "nul", nul));
		return violations.sort((a, b) => a.offset - b.offset);
	}

	/**
	 * Read and classify each file, in order.
	 *
	 * @param paths - Files to check
	 * @returns One finding per violation, empty when every file passes
	 */
	static checkFiles(
		paths: ReadonlyArray<string>,
	): Effect.Effect<ReadonlyArray<TextFileFinding>, PlatformError.PlatformError, FileSystem.FileSystem> {
		return Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const perFile = yield* Effect.forEach(
				paths,
				(path) =>
					Effect.map(fs.readFile(path), (bytes) =>
						TextFiles.classify(bytes).map((v) => TextFileFinding.make({ path, ...v })),
					),
				{ concurrency: 16 },
			);
			return perFile.flat();
		});
	}

	/**
	 * Read a file's staged bytes from the git index, not the working tree.
	 *
	 * @remarks
	 * Runs `git cat-file blob :./<name>` from the file's own directory, so an
	 * absolute path (what lint-staged passes) and a relative one both resolve
	 * against the right repository without computing a repo-relative path.
	 * When that directory is gone from the working tree (a staged file whose
	 * directory was deleted, deletion unstaged), it runs from the nearest
	 * existing ancestor with the path relative to it instead.
	 * Stdout is collected as raw bytes — `\@effected/git`'s `show` decodes to a
	 * string, which would erase exactly the NULs and invalid bytes this check
	 * looks for. Reading the index makes the lint-staged run race-free against
	 * concurrent `--write` tasks on the working tree, and checks exactly what
	 * the commit will record.
	 *
	 * @param path - File path, absolute or relative to the process cwd
	 * @returns The staged blob's bytes
	 */
	static readStaged(
		path: string,
	): Effect.Effect<
		Uint8Array,
		TextFileStagedReadError | PlatformError.PlatformError,
		ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
	> {
		return Effect.scoped(
			Effect.gen(function* () {
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				let cwd = pathService.dirname(path);
				while (!(yield* fs.exists(cwd))) {
					const parent = pathService.dirname(cwd);
					if (parent === cwd) break;
					cwd = parent;
				}
				const relative = pathService.relative(cwd, path).split(pathService.sep).join("/");
				const command = ChildProcess.make("git", ["cat-file", "blob", `:./${relative}`], { cwd });
				const handle = yield* spawner.spawn(command);
				const [chunks, stderr, exitCode] = yield* Effect.all(
					[Stream.runCollect(handle.stdout), Stream.mkString(Stream.decodeText(handle.stderr)), handle.exitCode],
					{ concurrency: "unbounded" },
				);
				if (exitCode !== 0) {
					return yield* new TextFileStagedReadError({ path, exitCode, stderr });
				}
				const out = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.length, 0));
				let at = 0;
				for (const chunk of chunks) {
					out.set(chunk, at);
					at += chunk.length;
				}
				return out;
			}),
		);
	}

	/**
	 * Read each file's STAGED content (see {@link TextFiles.readStaged}) and
	 * classify it, in order.
	 *
	 * @remarks
	 * Every file is checked: a file whose staged content cannot be read is
	 * collected into {@link TextFileStagedCheck.unreadable} rather than
	 * failing the whole check, so it cannot hide findings in the others. Only
	 * a platform failure (git could not be spawned) fails the effect.
	 *
	 * @param paths - Files to check
	 * @returns The findings, and a read error per unreadable file; both empty when every staged blob passes
	 */
	static checkStagedFiles(
		paths: ReadonlyArray<string>,
	): Effect.Effect<
		TextFileStagedCheck,
		PlatformError.PlatformError,
		ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
	> {
		return Effect.map(
			Effect.forEach(
				paths,
				(path) =>
					TextFiles.readStaged(path).pipe(
						Effect.map((bytes) => TextFiles.classify(bytes).map((v) => TextFileFinding.make({ path, ...v }))),
						Effect.catchTag("TextFileStagedReadError", (error) => Effect.succeed(error)),
					),
				{ concurrency: 8 },
			),
			(perFile) => ({
				findings: perFile.flatMap((outcome) => (Array.isArray(outcome) ? outcome : [])),
				unreadable: perFile.filter((outcome): outcome is TextFileStagedReadError => !Array.isArray(outcome)),
			}),
		);
	}

	/**
	 * List the git-tracked files under `cwd` that this check covers.
	 *
	 * @remarks
	 * Reads the index (`git ls-files`), keeping regular files (modes `100644`
	 * and `100755`) — gitlinks and symlinks are not file contents — that match
	 * {@link TextFiles.matches} and are not excluded. For a worktree check the
	 * file must also still exist in the working tree; with `staged: true` it
	 * need not, since a file deleted from the worktree without the deletion
	 * staged is still in the commit and {@link TextFiles.readStaged} reads its
	 * blob from the index. Paths come back joined onto `cwd`, deduplicated
	 * across the stages of an unresolved merge.
	 *
	 * @param cwd - Repository directory to list from
	 * @param options - `exclude` patterns (defaults to {@link TextFiles.defaultExcludes}) and `staged`
	 * @returns The files to check
	 */
	static listTracked(
		cwd: string,
		options: TextFilesListOptions = {},
	): Effect.Effect<
		ReadonlyArray<string>,
		GitCommandError | NotARepositoryError | UnknownRefError | PlatformError.PlatformError,
		Git | FileSystem.FileSystem | Path.Path
	> {
		return Effect.gen(function* () {
			const git = yield* Git;
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const excludes = options.exclude ?? [...TextFiles.defaultExcludes];
			const entries = yield* git.lsFiles(cwd);
			const candidates = [
				...new Set(
					entries
						.filter((entry) => entry.mode === "100644" || entry.mode === "100755")
						.map((entry) => entry.path)
						.filter((file) => TextFiles.matches(file)),
				),
			];
			const kept = Filter.exclude(candidates, excludes).map((file) => path.join(cwd, file));
			if (options.staged) return kept;
			return yield* Effect.filter(kept, (file) => fs.exists(file), { concurrency: 16 });
		});
	}

	/**
	 * Create a handler with custom options.
	 *
	 * @remarks
	 * Returns a `savvy lint text --staged <files>` command rather than checking
	 * in the handler body, so the check runs with the same code as the CLI.
	 * `--staged` reads each file from the git index: lint-staged runs other
	 * glob keys (Biome `--write`) concurrently against the working tree, and a
	 * worktree read could observe a half-written file. The index only changes
	 * when lint-staged re-stages, after every task has finished.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	static create(options: TextFilesOptions = {}): LintStagedHandler {
		const excludes = options.exclude ?? [...TextFiles.defaultExcludes];

		return (filenames: readonly string[]): string | string[] => {
			const filtered = Filter.exclude(filenames, excludes);

			if (filtered.length === 0) {
				return [];
			}

			const cmd = Command.findSavvyLint();
			return `${cmd} text --staged ${Filter.shellEscape(filtered)}`;
		};
	}
}
