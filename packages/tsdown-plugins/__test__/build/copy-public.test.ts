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
});
