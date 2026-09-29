import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Git, LsFilesEntry } from "@effected/git";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, Layer, Path } from "effect";
import { Lint } from "../../src/index.js";

const { TextFiles, Preset, createConfig } = Lint;

const encoder = new TextEncoder();
const bytes = (...parts: ReadonlyArray<string | ReadonlyArray<number>>): Uint8Array => {
	const chunks = parts.map((part) => (typeof part === "string" ? encoder.encode(part) : Uint8Array.from(part)));
	const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.length;
	}
	return out;
};

const isValidUtf8 = (input: Uint8Array): boolean => {
	try {
		new TextDecoder("utf-8", { fatal: true }).decode(input);
		return true;
	} catch {
		return false;
	}
};

describe("TextFiles.classify", () => {
	it("passes plain text", () => {
		expect(TextFiles.classify(bytes("export const a = 1;\n"))).toEqual([]);
	});

	it("passes an empty file", () => {
		expect(TextFiles.classify(new Uint8Array())).toEqual([]);
	});

	it("passes a UTF-8 BOM", () => {
		expect(TextFiles.classify(bytes([0xef, 0xbb, 0xbf], "# title\n"))).toEqual([]);
	});

	it("passes multi-byte text (2-, 3- and 4-byte sequences)", () => {
		expect(TextFiles.classify(bytes("é — 日本 🎉\n"))).toEqual([]);
	});

	it("flags a NUL at the start", () => {
		const [violation, ...rest] = TextFiles.classify(bytes([0], "abc\n"));
		expect(rest).toEqual([]);
		expect(violation).toMatchObject({ reason: "nul", offset: 0, line: 1, column: 1 });
	});

	it("flags a NUL in the middle with a 1-based line and character column", () => {
		const [violation] = TextFiles.classify(bytes("line one\nconst é = '", [0], "';\n"));
		// 'const é = ' is 10 characters (é is two bytes), so the NUL is column 12.
		expect(violation).toMatchObject({ reason: "nul", offset: 21, line: 2, column: 12 });
	});

	it("flags a NUL as the last byte", () => {
		const [violation] = TextFiles.classify(bytes("a\nb", [0]));
		expect(violation).toMatchObject({ reason: "nul", offset: 3, line: 2, column: 2 });
	});

	it("flags a NUL past the first 8000 bytes (git grep -I only looks that far)", () => {
		const input = bytes("x".repeat(9000), [0], "\n");
		const [violation] = TextFiles.classify(input);
		expect(violation).toMatchObject({ reason: "nul", offset: 9000, line: 1, column: 9001 });
	});

	it("reports only the first NUL", () => {
		expect(TextFiles.classify(bytes("a", [0], "b", [0]))).toHaveLength(1);
	});

	it("flags a lone continuation byte", () => {
		const [violation] = TextFiles.classify(bytes("ab\ncd", [0x80], "\n"));
		expect(violation).toMatchObject({ reason: "invalid-utf8", offset: 5, line: 2, column: 3 });
	});

	it("flags a truncated multi-byte sequence at end of file", () => {
		const [violation] = TextFiles.classify(bytes("ok ", [0xe6, 0x97]));
		expect(violation).toMatchObject({ reason: "invalid-utf8", offset: 3, line: 1, column: 4 });
	});

	it("flags a truncated sequence interrupted by ASCII", () => {
		const [violation] = TextFiles.classify(bytes([0xe6, 0x97], "x"));
		expect(violation).toMatchObject({ reason: "invalid-utf8", offset: 0 });
	});

	it("flags an overlong encoding", () => {
		// 0xC0 0xAF is an overlong '/'.
		const [violation] = TextFiles.classify(bytes("a", [0xc0, 0xaf]));
		expect(violation).toMatchObject({ reason: "invalid-utf8", offset: 1 });
		// 0xE0 0x80 0xAF is a three-byte overlong '/'.
		expect(TextFiles.classify(bytes([0xe0, 0x80, 0xaf]))[0]).toMatchObject({ reason: "invalid-utf8", offset: 0 });
	});

	it("flags an encoded surrogate and a code point past U+10FFFF", () => {
		expect(TextFiles.classify(bytes([0xed, 0xa0, 0x80]))[0]).toMatchObject({ reason: "invalid-utf8" });
		expect(TextFiles.classify(bytes([0xf4, 0x90, 0x80, 0x80]))[0]).toMatchObject({ reason: "invalid-utf8" });
		expect(TextFiles.classify(bytes([0xff]))[0]).toMatchObject({ reason: "invalid-utf8" });
	});

	it("reports both reasons, ordered by offset, when a file has both", () => {
		const violations = TextFiles.classify(bytes("a", [0xff], "b", [0]));
		expect(violations.map((v) => [v.reason, v.offset])).toEqual([
			["invalid-utf8", 1],
			["nul", 3],
		]);
	});

	it("does not count a leading BOM as a column", () => {
		const [violation] = TextFiles.classify(bytes([0xef, 0xbb, 0xbf], "ab", [0]));
		expect(violation).toMatchObject({ reason: "nul", line: 1, column: 3 });
	});

	it("agrees with the fatal TextDecoder on every 1- and 2-byte input", () => {
		const disagreements: Array<string> = [];
		for (let a = 0; a < 256; a++) {
			for (let b = -1; b < 256; b++) {
				const input = b < 0 ? Uint8Array.of(a) : Uint8Array.of(a, b);
				const flagged = TextFiles.classify(input).some((v) => v.reason === "invalid-utf8");
				if (flagged === isValidUtf8(input)) disagreements.push(Array.from(input).join(","));
			}
		}
		expect({ count: disagreements.length, first: disagreements.slice(0, 8) }).toEqual({ count: 0, first: [] });
	});

	it("agrees with the fatal TextDecoder on every 3- and 4-byte sequence led by E0-F4", () => {
		const disagreements: Array<string> = [];
		const probes = [0x00, 0x41, 0x7f, 0x80, 0x8f, 0x90, 0x9f, 0xa0, 0xbf, 0xc0, 0xc2, 0xe0, 0xf0, 0xff];
		for (let lead = 0xe0; lead <= 0xf4; lead++) {
			for (let b = 0; b < 256; b++) {
				for (const c of probes) {
					for (const d of [-1, 0x41, 0x80, 0xbf, 0xc0]) {
						const input = d < 0 ? Uint8Array.of(lead, b, c) : Uint8Array.of(lead, b, c, d);
						const flagged = TextFiles.classify(input).some((v) => v.reason === "invalid-utf8");
						if (flagged === isValidUtf8(input)) disagreements.push(Array.from(input).join(","));
					}
				}
			}
		}
		expect({ count: disagreements.length, first: disagreements.slice(0, 8) }).toEqual({ count: 0, first: [] });
	});
});

describe("TextFiles.matches", () => {
	it("matches the source/text extensions and rejects the rest", () => {
		for (const file of ["a.ts", "src/b.tsx", "c.d.cts", "d.mjs", "e.json", "f.jsonc", "g.md", "h.yaml", "i.sh"]) {
			expect(TextFiles.matches(file), file).toBe(true);
		}
		for (const file of ["logo.png", "font.woff2", "archive.tgz", "Makefile", "ts"]) {
			expect(TextFiles.matches(file), file).toBe(false);
		}
	});

	it("derives its lint-staged glob from the same extension list", () => {
		expect(TextFiles.glob).toBe(`**/*.{${TextFiles.extensions.join(",")}}`);
		for (const ext of ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "mdx"]) {
			expect(TextFiles.extensions).toContain(ext);
		}
		for (const ext of ["yml", "yaml", "sh"]) {
			expect(TextFiles.extensions).toContain(ext);
		}
	});
});

describe("TextFiles handler", () => {
	it("returns a savvy lint text command over the staged files", () => {
		const result = TextFiles.handler(["src/a.ts", "docs/it's.md"]);
		expect(typeof result).toBe("string");
		expect(result).toMatch(/ lint text --staged 'src\/a\.ts' 'docs\/it'\\''s\.md'$/);
	});

	it("filters excluded files", () => {
		const result = TextFiles.create({ exclude: ["vendor/"] })(["vendor/x.ts", "src/y.ts"]);
		expect(result).toContain("text --staged 'src/y.ts'");
		expect(result).not.toContain("vendor/x.ts");
	});

	it("returns no command when every file is excluded", () => {
		expect(TextFiles.create({ exclude: ["vendor/"] })(["vendor/x.ts"])).toEqual([]);
		expect(TextFiles.handler([])).toEqual([]);
	});
});

describe("TextFiles in presets", () => {
	it("is registered by createConfig by default and can be disabled", () => {
		expect(createConfig()[TextFiles.glob]).toBeDefined();
		expect(createConfig({ textFiles: false })[TextFiles.glob]).toBeUndefined();
	});

	it("is in the silk and standard presets but not minimal", () => {
		expect(Preset.silk()[TextFiles.glob]).toBeDefined();
		expect(Preset.standard()[TextFiles.glob]).toBeDefined();
		expect(Preset.minimal()[TextFiles.glob]).toBeUndefined();
		expect(Preset.minimal({ textFiles: {} })[TextFiles.glob]).toBeDefined();
	});

	it("does not collide with any other handler's glob key", () => {
		const keys = Object.keys(Preset.silk());
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.filter((key) => key === TextFiles.glob)).toHaveLength(1);
		// createConfig assigns one key per handler; a shared key would silently drop one.
		expect(keys).toHaveLength(8);
	});
});

const entry = (path: string, mode = "100644", stage = 0) =>
	LsFilesEntry.make({ mode, oid: "0".repeat(40), stage, path });

describe("TextFiles.checkFiles", () => {
	it.effect("reads each file and attaches its path to every violation", () =>
		Effect.gen(function* () {
			const findings = yield* TextFiles.checkFiles(["/repo/ok.ts", "/repo/bad.ts", "/repo/latin1.md"]);
			expect(findings.map((f) => [f.path, f.reason, f.line, f.column])).toEqual([
				["/repo/bad.ts", "nul", 2, 5],
				["/repo/latin1.md", "invalid-utf8", 1, 5],
			]);
			expect(findings[0]?.message).toContain("\\0");
			expect(findings[0]?.location).toBe("/repo/bad.ts:2:5");
		}).pipe(
			Effect.provide(
				MemoryFileSystem.layerWith({
					"/repo/ok.ts": "export {};\n",
					"/repo/bad.ts": bytes("x\nabc'", [0], "'\n"),
					// Latin-1 'é' (0xE9) followed by ASCII: a truncated three-byte lead.
					"/repo/latin1.md": bytes("cafe", [0xe9], "\n"),
				}),
			),
		),
	);

	it.effect("fails typed when a file cannot be read", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(TextFiles.checkFiles(["/repo/missing.ts"]));
			expect(error._tag).toBe("PlatformError");
		}).pipe(Effect.provide(MemoryFileSystem.layerWith({ "/repo/present.ts": "" }))),
	);
});

describe("TextFiles.listTracked", () => {
	const git = Git.layerTest({
		lsFiles: () =>
			Effect.succeed([
				entry("src/a.ts"),
				entry("bin/run.sh", "100755"),
				entry("assets/logo.png"),
				entry(".repos/effect", "160000"),
				entry("link.ts", "120000"),
				entry("conflict.ts", "100644", 1),
				entry("conflict.ts", "100644", 2),
				entry("deleted.md"),
				entry("vendor/x.ts"),
			]),
	});
	const fs = MemoryFileSystem.layerWith({
		"/repo/src/a.ts": "",
		"/repo/bin/run.sh": "",
		"/repo/assets/logo.png": "",
		"/repo/link.ts": "",
		"/repo/conflict.ts": "",
		"/repo/vendor/x.ts": "",
	});
	const layer = Layer.mergeAll(git, fs, Path.layer);

	it.effect("keeps regular tracked files that match, exist, and are not excluded", () =>
		Effect.gen(function* () {
			const files = yield* TextFiles.listTracked("/repo", { exclude: ["vendor/"] });
			expect(files).toEqual(["/repo/src/a.ts", "/repo/bin/run.sh", "/repo/conflict.ts"]);
		}).pipe(Effect.provide(layer)),
	);

	it.effect("applies the default excludes when none are given", () =>
		Effect.gen(function* () {
			const files = yield* TextFiles.listTracked("/repo");
			expect(files).toContain("/repo/vendor/x.ts");
		}).pipe(Effect.provide(layer)),
	);
});

/**
 * `--staged` reads the git index, which memfs cannot model, so these run
 * against a real temp repository: each file is staged with one content and
 * then rewritten in the worktree, so a worktree read and an index read of the
 * same path disagree.
 */
describe("TextFiles.readStaged / checkStagedFiles (real temp git repo)", () => {
	let root: string;
	const git = (...args: ReadonlyArray<string>) => execFileSync("git", args, { cwd: root, stdio: "pipe" });

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "text-files-staged-"));
		git("init", "-q");
		mkdirSync(join(root, "src"));
		// Staged: NUL. Worktree: clean.
		writeFileSync(join(root, "src/index-dirty.ts"), bytes("const a = '", [0], "';\n"));
		// Staged: clean. Worktree: invalid UTF-8.
		writeFileSync(join(root, "clean-in-index.md"), "# ok\n");
		git("add", "src/index-dirty.ts", "clean-in-index.md");
		writeFileSync(join(root, "src/index-dirty.ts"), "const a = '\\0';\n");
		writeFileSync(join(root, "clean-in-index.md"), bytes("caf", [0xe9], "\n"));
		// Never staged.
		writeFileSync(join(root, "untracked.ts"), "export {};\n");
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it.effect("reads the index blob byte-for-byte, not the worktree file", () =>
		Effect.gen(function* () {
			const staged = yield* TextFiles.readStaged(join(root, "src/index-dirty.ts"));
			expect(Array.from(staged)).toEqual(Array.from(bytes("const a = '", [0], "';\n")));
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("flags what is staged and ignores what is only in the worktree", () =>
		Effect.gen(function* () {
			const files = [join(root, "src/index-dirty.ts"), join(root, "clean-in-index.md")];
			const staged = yield* TextFiles.checkStagedFiles(files);
			expect(staged.map((f) => [f.path, f.reason, f.line, f.column])).toEqual([
				[join(root, "src/index-dirty.ts"), "nul", 1, 12],
			]);
			// Control: the worktree read of the same paths sees the opposite.
			const worktree = yield* TextFiles.checkFiles(files);
			expect(worktree.map((f) => [f.path, f.reason])).toEqual([[join(root, "clean-in-index.md"), "invalid-utf8"]]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("fails typed when the path has no index entry", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(TextFiles.readStaged(join(root, "untracked.ts")));
			expect(error._tag).toBe("TextFileStagedReadError");
			if (error._tag !== "TextFileStagedReadError") throw new Error("expected a staged-read error");
			expect(error.path).toBe(join(root, "untracked.ts"));
			expect(error.exitCode).not.toBe(0);
			expect(error.message).toContain("untracked.ts");
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
