import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyPublicDir } from "../../src/build/sync-public.js";
import { ConfigValidationError } from "../../src/errors.js";

let root: string;
let src: string;
let out: string;

function write(base: string, rel: string, content: string): void {
	const abs = join(base, rel);
	mkdirSync(dirname(abs), { recursive: true });
	writeFileSync(abs, content, "utf-8");
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "copy-public-"));
	src = join(root, "public");
	out = join(root, "out", "pkg");
	mkdirSync(out, { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("copyPublicDir", () => {
	it("no-ops when the source does not exist", () => {
		expect(() => copyPublicDir(src, out)).not.toThrow();
	});

	it("accepts a source directory relative to the process cwd", () => {
		write(src, "a.txt", "a");
		const prevCwd = process.cwd();
		process.chdir(root);
		try {
			copyPublicDir("public", out);
		} finally {
			process.chdir(prevCwd);
		}
		expect(readFileSync(join(out, "a.txt"), "utf-8")).toBe("a");
	});

	it("copies dotfiles, dot-directories and node_modules/ under public", () => {
		write(src, ".npmrc", "a");
		write(src, ".well-known/security.txt", "b");
		write(src, "node_modules/x/index.js", "c");
		copyPublicDir(src, out);
		expect(readFileSync(join(out, ".npmrc"), "utf-8")).toBe("a");
		expect(readFileSync(join(out, ".well-known", "security.txt"), "utf-8")).toBe("b");
		expect(readFileSync(join(out, "node_modules", "x", "index.js"), "utf-8")).toBe("c");
	});

	it("flattens public/<path> to the out root (drops the public/ segment)", () => {
		write(src, "ecma.json", "{}");
		write(src, "tsconfig/action.json", "{ }");
		copyPublicDir(src, out);
		expect(readFileSync(join(out, "ecma.json"), "utf-8")).toBe("{}");
		expect(readFileSync(join(out, "tsconfig/action.json"), "utf-8")).toBe("{ }");
		expect(existsSync(join(out, "public"))).toBe(false);
	});

	it("does NOT delete sibling files already in the out dir (additive)", () => {
		write(out, "index.js", "export {};");
		write(src, "ecma.json", "{}");
		copyPublicDir(src, out);
		expect(existsSync(join(out, "index.js"))).toBe(true);
		expect(existsSync(join(out, "ecma.json"))).toBe(true);
	});

	it("skips an identical prior copy without rewriting", () => {
		write(src, "ecma.json", "{}");
		write(out, "ecma.json", "{}");
		expect(() => copyPublicDir(src, out)).not.toThrow();
		expect(readFileSync(join(out, "ecma.json"), "utf-8")).toBe("{}");
	});

	it("throws ConfigValidationError when a public path collides with a differing built output", () => {
		write(src, "index.js", "// public");
		write(out, "index.js", "// built output");
		expect(() => copyPublicDir(src, out)).toThrow(ConfigValidationError);
	});

	it("throws ConfigValidationError when a public file collides with a built directory", () => {
		write(src, "foo", "public file");
		mkdirSync(join(out, "foo"), { recursive: true });
		expect(() => copyPublicDir(src, out)).toThrow(ConfigValidationError);
	});

	it("throws ConfigValidationError when a nested public file collides with a built file at a parent path", () => {
		write(src, "foo/bar", "public nested");
		write(out, "foo", "built file");
		expect(() => copyPublicDir(src, out)).toThrow(ConfigValidationError);
	});
});
