import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { effectToZodSchema } from "../../src/schema/effect-to-zod.js";
import {
	BiomeCheckAsMarkdown,
	BiomeCheckResult,
	buildBiomeResult,
	parseBiomeGitlab,
	runBiomeCheck,
} from "../../src/tools/biome-check.js";

const SAMPLE = JSON.stringify([
	{
		description: "Unexpected any.",
		check_name: "lint/suspicious/noExplicitAny",
		fingerprint: "abc",
		severity: "major",
		location: { path: "src/x.ts", lines: { begin: 12 } },
	},
	{
		description: "Forgotten semicolon style.",
		check_name: "format",
		fingerprint: "def",
		severity: "minor",
		location: { path: "src/y.ts", lines: { begin: 3 } },
	},
]);

describe("parseBiomeGitlab", () => {
	it("maps gitlab diagnostics and normalizes severity", () => {
		const diags = parseBiomeGitlab(SAMPLE);
		expect(diags).toHaveLength(2);
		expect(diags[0]).toEqual({
			file: "src/x.ts",
			line: 12,
			severity: "error",
			rule: "lint/suspicious/noExplicitAny",
			message: "Unexpected any.",
		});
		expect(diags[1].severity).toBe("warning");
	});

	it("returns [] for empty or invalid stdout", () => {
		expect(parseBiomeGitlab("")).toEqual([]);
		expect(parseBiomeGitlab("   ")).toEqual([]);
		expect(parseBiomeGitlab("not json")).toEqual([]);
		expect(parseBiomeGitlab("{}")).toEqual([]);
	});
});

describe("buildBiomeResult", () => {
	it("counts severities and carries the wrote flag + guidance", () => {
		const diags = parseBiomeGitlab(SAMPLE);
		const result = buildBiomeResult({ diagnostics: diags, wrote: true });
		expect(result.summary).toEqual({ errors: 1, warnings: 1 });
		expect(result.wrote).toBe(true);
		expect(result.diagnostics).toHaveLength(2);
		expect(result.guidance).toContain("Do NOT disable rules");
	});
});

describe("BiomeCheckAsMarkdown", () => {
	it("renders diagnostics", () => {
		const result = buildBiomeResult({ diagnostics: parseBiomeGitlab(SAMPLE), wrote: false });
		const md = Schema.decodeSync(BiomeCheckAsMarkdown)(result);
		expect(md).toContain("src/x.ts:12");
		expect(md).toContain("noExplicitAny");
	});

	it("renders the clean state", () => {
		const result = buildBiomeResult({ diagnostics: [], wrote: false });
		const md = Schema.decodeSync(BiomeCheckAsMarkdown)(result);
		expect(md).toContain("No remaining diagnostics");
	});

	it("notes the write pass in the clean state", () => {
		const result = buildBiomeResult({ diagnostics: [], wrote: true });
		const md = Schema.decodeSync(BiomeCheckAsMarkdown)(result);
		expect(md).toContain("No remaining diagnostics");
		expect(md).toContain("git diff");
	});

	it("is one-way (encode forbidden)", () => {
		expect(() => Schema.encodeSync(BiomeCheckAsMarkdown)("anything")).toThrow();
	});
});

describe("runBiomeCheck containment", () => {
	// These reject during path resolution, before any biome binary lookup or
	// subprocess spawn, so they run without Biome installed.
	it("rejects a cwd outside the workspace root", async () => {
		await expect(runBiomeCheck({ cwd: "/etc", write: true }, "/repo")).rejects.toThrow(/escapes the workspace root/);
	});

	it("rejects a relative path that escapes the workspace root", async () => {
		await expect(runBiomeCheck({ paths: ["../../etc"], write: true }, "/repo")).rejects.toThrow(
			/escapes the workspace root/,
		);
	});

	it("rejects an absolute path outside the workspace root", async () => {
		await expect(runBiomeCheck({ paths: ["/etc/passwd"] }, "/repo")).rejects.toThrow(/escapes the workspace root/);
	});

	it("rejects a symlinked path whose target escapes the workspace root (write mode)", async () => {
		const base = realpathSync(mkdtempSync(join(tmpdir(), "biome-cont-")));
		const root = join(base, "workspace");
		const outside = join(base, "outside");
		mkdirSync(root);
		mkdirSync(outside);
		writeFileSync(join(outside, "evil.ts"), "const x = 1;\n");
		symlinkSync(join(outside, "evil.ts"), join(root, "link.ts"));
		try {
			await expect(runBiomeCheck({ paths: ["link.ts"], write: true }, root)).rejects.toThrow(
				/escapes the workspace root/,
			);
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
	});

	it("rejects a symlinked cwd whose target escapes the workspace root", async () => {
		const base = realpathSync(mkdtempSync(join(tmpdir(), "biome-cont-")));
		const root = join(base, "workspace");
		const outside = join(base, "outside");
		mkdirSync(root);
		mkdirSync(outside);
		symlinkSync(outside, join(root, "linkdir"));
		try {
			await expect(runBiomeCheck({ cwd: join(root, "linkdir"), write: true }, root)).rejects.toThrow(
				/escapes the workspace root/,
			);
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
	});
});

describe("biome_check effect->zod bridge", () => {
	it("parses a valid payload", () => {
		const zodSchema = effectToZodSchema(BiomeCheckResult);
		const parsed = zodSchema.safeParse({
			summary: { errors: 0, warnings: 0 },
			diagnostics: [],
			wrote: false,
			guidance: "x",
		});
		expect(parsed.success).toBe(true);
	});
});
