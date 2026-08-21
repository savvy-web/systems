import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { effectToZodSchema } from "../../src/schema/effect-to-zod.js";
import {
	BiomeCheckAsMarkdown,
	BiomeCheckResult,
	buildBiomeResult,
	parseBiomeGitlab,
	resolveContainmentRoot,
	runBiomeCheck,
} from "../../src/tools/biome-check.js";

const SAMPLE = JSON.stringify([
	{
		description: "Unexpected any.",
		check_name: "lint/suspicious/noExplicitAny",
		fingerprint: "abc",
		severity: "critical",
		location: { path: "src/x.ts", lines: { begin: 12 } },
	},
	{
		description: "Forgotten semicolon style.",
		check_name: "format",
		fingerprint: "def",
		severity: "major",
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

	// Biome's gitlab reporter (crates/biome_cli/src/reporter/gitlab.rs) maps its own
	// Severity onto GitLab's codequality scale: Hint => info, Information => minor,
	// Warning => major, Error => critical, Fatal => blocker. Reading "major" as an
	// error shifts every level one step too severe — systems#516.
	it("inverts the gitlab reporter's severity table exactly", () => {
		const cases = [
			["info", "info"],
			["minor", "info"],
			["major", "warning"],
			["critical", "error"],
			["blocker", "error"],
		] as const;
		for (const [gitlab, expected] of cases) {
			const [diag] = parseBiomeGitlab(
				JSON.stringify([
					{
						description: "d",
						check_name: "r",
						severity: gitlab,
						location: { path: "a.ts", lines: { begin: 1 } },
					},
				]),
			);
			expect(diag?.severity, `gitlab "${gitlab}" should normalize to "${expected}"`).toBe(expected);
		}
	});

	it("does not report a project warning as an error (systems#516)", () => {
		const diags = parseBiomeGitlab(
			JSON.stringify([
				{
					description: "This import is unused.",
					check_name: "lint/correctness/noUnusedImports",
					severity: "major",
					location: { path: "src/x.ts", lines: { begin: 1 } },
				},
			]),
		);
		expect(diags[0]?.severity).toBe("warning");
		const result = buildBiomeResult({ diagnostics: diags, wrote: false });
		expect(result.summary).toEqual({ errors: 0, warnings: 1 });
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

	it("honors project severities by default: warnings stay warnings with non-blocking guidance", () => {
		const diags = parseBiomeGitlab(SAMPLE).filter((d) => d.severity === "warning");
		const result = buildBiomeResult({ diagnostics: diags, wrote: false });
		expect(result.summary).toEqual({ errors: 0, warnings: 1 });
		expect(result.diagnostics[0].severity).toBe("warning");
		expect(result.diagnostics[0].originalSeverity).toBeUndefined();
		expect(result.guidance).toContain("do not block");
	});

	it("strict upgrades warnings to errors, preserving originalSeverity and counting the upgrade", () => {
		const diags = parseBiomeGitlab(SAMPLE);
		const result = buildBiomeResult({ diagnostics: diags, wrote: false, strict: true });
		expect(result.summary).toEqual({ errors: 2, warnings: 0, upgradedWarnings: 1 });
		const upgraded = result.diagnostics.find((d) => d.rule === "format");
		expect(upgraded?.severity).toBe("error");
		expect(upgraded?.originalSeverity).toBe("warning");
		const real = result.diagnostics.find((d) => d.rule === "lint/suspicious/noExplicitAny");
		expect(real?.severity).toBe("error");
		expect(real?.originalSeverity).toBeUndefined();
		expect(result.guidance).toContain("not CI blockers");
	});
});

describe("BiomeCheckAsMarkdown", () => {
	it("renders diagnostics", () => {
		const result = buildBiomeResult({ diagnostics: parseBiomeGitlab(SAMPLE), wrote: false });
		const md = Schema.decodeUnknownSync(BiomeCheckAsMarkdown)(result);
		expect(md).toContain("src/x.ts:12");
		expect(md).toContain("noExplicitAny");
	});

	it("renders the clean state", () => {
		const result = buildBiomeResult({ diagnostics: [], wrote: false });
		const md = Schema.decodeUnknownSync(BiomeCheckAsMarkdown)(result);
		expect(md).toContain("No remaining diagnostics");
	});

	it("notes the write pass in the clean state", () => {
		const result = buildBiomeResult({ diagnostics: [], wrote: true });
		const md = Schema.decodeUnknownSync(BiomeCheckAsMarkdown)(result);
		expect(md).toContain("No remaining diagnostics");
		expect(md).toContain("git diff");
	});

	it("marks strict-upgraded diagnostics in the rendered markdown", () => {
		const result = buildBiomeResult({ diagnostics: parseBiomeGitlab(SAMPLE), wrote: false, strict: true });
		const md = Schema.decodeUnknownSync(BiomeCheckAsMarkdown)(result);
		expect(md).toContain("strict-upgraded from project warnings");
		expect(md).toContain("(project warning, strict)");
	});

	it("is one-way (encode forbidden)", () => {
		expect(() => Schema.encodeUnknownSync(BiomeCheckAsMarkdown)("anything")).toThrow();
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

describe("resolveContainmentRoot (systems#482)", () => {
	// A root-bound tool invoked from a sibling worktree silently operated on the
	// MAIN checkout — in a parallel multi-agent session, another agent's tree.
	// Containment must follow the worktree, not the server's start directory.
	const probe = (map: Record<string, { commonDir: string; topLevel: string }>) => (dir: string) => map[dir] ?? null;

	it("keeps the root for a cwd inside it", () => {
		expect(resolveContainmentRoot("/repo", "/repo/packages/mcp", probe({}))).toBe("/repo");
		expect(resolveContainmentRoot("/repo", "/repo", probe({}))).toBe("/repo");
	});

	it("accepts a worktree of the same repository and contains to that worktree", () => {
		const p = probe({
			"/repo": { commonDir: "/repo/.git", topLevel: "/repo" },
			"/wt/feature/src": { commonDir: "/repo/.git", topLevel: "/wt/feature" },
		});
		expect(resolveContainmentRoot("/repo", "/wt/feature/src", p)).toBe("/wt/feature");
	});

	it("rejects a worktree of a different repository", () => {
		const p = probe({
			"/repo": { commonDir: "/repo/.git", topLevel: "/repo" },
			"/other": { commonDir: "/other/.git", topLevel: "/other" },
		});
		expect(resolveContainmentRoot("/repo", "/other", p)).toBeNull();
	});

	it("rejects a directory that is not a git repository", () => {
		const p = probe({ "/repo": { commonDir: "/repo/.git", topLevel: "/repo" } });
		expect(resolveContainmentRoot("/repo", "/etc", p)).toBeNull();
	});

	it("rejects when the root itself is not a git repository", () => {
		const p = probe({ "/wt": { commonDir: "/repo/.git", topLevel: "/wt" } });
		expect(resolveContainmentRoot("/repo", "/wt", p)).toBeNull();
	});

	it("does not treat a lexical prefix as containment", () => {
		expect(resolveContainmentRoot("/repo", "/repo-evil", probe({}))).toBeNull();
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
