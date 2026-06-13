/**
 * The `biome_check` MCP tool: a thin proxy that runs Biome over a path with the
 * gitlab reporter, parses it into a typed result, and can apply fixes. Unlike the
 * other savvy-mcp tools this one MUTATES the working tree when `write`/`unsafe`
 * is set — the first intentional exception to the read-only convention.
 *
 * @packageDocumentation
 */

import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { Lint } from "@savvy-web/silk-effects";
import { ParseResult, Schema } from "effect";

/** Normalized diagnostic severity. */
export const BiomeSeverity = Schema.Literal("error", "warning", "info");

/** A single normalized Biome diagnostic. */
export const BiomeDiagnostic = Schema.Struct({
	file: Schema.String,
	line: Schema.Number,
	severity: BiomeSeverity,
	rule: Schema.String,
	message: Schema.String,
}).annotations({ identifier: "BiomeDiagnostic" });

export type BiomeDiagnosticType = Schema.Schema.Type<typeof BiomeDiagnostic>;

/** The `biome_check` tool result. */
export const BiomeCheckResult = Schema.Struct({
	summary: Schema.Struct({ errors: Schema.Number, warnings: Schema.Number }),
	diagnostics: Schema.Array(BiomeDiagnostic),
	wrote: Schema.Boolean,
	guidance: Schema.String,
}).annotations({
	identifier: "BiomeCheckResult",
	title: "biome_check result",
	description: "Structured Biome diagnostics, with a flag for whether a --write pass ran.",
});

export type BiomeCheckResultType = Schema.Schema.Type<typeof BiomeCheckResult>;

/** Guardrail shown to the agent so it fixes code rather than silencing rules. */
const GUIDANCE = "Fix the actual code. Do NOT disable rules or add config overrides to silence these.";

/** Shape of a single diagnostic in Biome's `--reporter=gitlab` output. */
const GitlabDiagnostic = Schema.Struct({
	description: Schema.String,
	check_name: Schema.String,
	severity: Schema.Literal("info", "minor", "major", "critical", "blocker"),
	location: Schema.Struct({ path: Schema.String, lines: Schema.Struct({ begin: Schema.Number }) }),
});
const GitlabArray = Schema.Array(GitlabDiagnostic);
const decodeGitlab = Schema.decodeUnknownSync(GitlabArray);

/** Map a gitlab severity onto our three-level scale. */
const mapSeverity = (s: "info" | "minor" | "major" | "critical" | "blocker"): "error" | "warning" | "info" =>
	s === "info" ? "info" : s === "minor" ? "warning" : "error";

/**
 * Parse Biome `--reporter=gitlab` stdout into normalized diagnostics. Returns []
 * for empty, non-JSON, or shape-mismatched input (never throws).
 */
export const parseBiomeGitlab = (stdout: string): readonly BiomeDiagnosticType[] => {
	const trimmed = stdout.trim();
	if (!trimmed) return [];
	let raw: unknown;
	try {
		raw = JSON.parse(trimmed);
	} catch {
		return [];
	}
	let decoded: ReadonlyArray<Schema.Schema.Type<typeof GitlabDiagnostic>>;
	try {
		decoded = decodeGitlab(raw);
	} catch {
		return [];
	}
	return decoded.map((d) => ({
		file: d.location.path,
		line: d.location.lines.begin,
		severity: mapSeverity(d.severity),
		rule: d.check_name,
		message: d.description,
	}));
};

/** Assemble the structured result from normalized diagnostics + the write flag. */
export const buildBiomeResult = (params: {
	diagnostics: readonly BiomeDiagnosticType[];
	wrote: boolean;
}): BiomeCheckResultType => {
	const errors = params.diagnostics.filter((d) => d.severity === "error").length;
	const warnings = params.diagnostics.filter((d) => d.severity === "warning").length;
	return {
		summary: { errors, warnings },
		diagnostics: [...params.diagnostics],
		wrote: params.wrote,
		guidance: GUIDANCE,
	};
};

/** Render the structured result as markdown. */
const renderMarkdown = (data: BiomeCheckResultType): string => {
	if (data.diagnostics.length === 0) {
		const wroteNote = data.wrote ? " A --write pass ran; check `git diff` for what changed." : "";
		return `# biome — clean\n\n✅ No remaining diagnostics.${wroteNote}`;
	}
	const lines = [`# biome — ${data.summary.errors} error(s), ${data.summary.warnings} warning(s)`, ``];
	if (data.wrote) lines.push(`A --write pass ran; the diagnostics below remain unfixed.`, ``);
	for (const d of data.diagnostics) {
		lines.push(`- \`${d.file}:${d.line}\` **${d.severity}** ${d.rule} — ${d.message}`);
	}
	lines.push(``, `---`, data.guidance);
	return lines.join("\n");
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const BiomeCheckAsMarkdown = Schema.transformOrFail(BiomeCheckResult, Schema.String, {
	strict: true,
	decode: (data) => ParseResult.succeed(renderMarkdown(data)),
	encode: (text, _options, ast) =>
		ParseResult.fail(
			new ParseResult.Forbidden(ast, text, "BiomeCheckAsMarkdown is one-way: markdown cannot be parsed back."),
		),
});

/** Arguments for the {@link runBiomeCheck} handler. */
export interface BiomeCheckArgs {
	readonly paths?: readonly string[];
	readonly mode?: "check" | "lint";
	readonly write?: boolean;
	readonly unsafe?: boolean;
	readonly cwd?: string;
}

/**
 * Run Biome and return structured diagnostics. When `write`/`unsafe` is set,
 * runs a fix pass first, then a read-only gitlab pass to report what remains.
 *
 * @remarks Resolves the Biome binary via {@link Lint.Biome.findBiome} (global
 * first, then the project's package manager). Throws if Biome is unavailable or
 * exits with status > 1 (Biome itself failed, vs. status 1 = lint issues found).
 */
export const runBiomeCheck = async (args: BiomeCheckArgs, fallbackCwd: string): Promise<BiomeCheckResultType> => {
	const mode = args.mode ?? "check";

	// Containment: this is a mutating tool, so keep cwd and every target path
	// inside the workspace root. Canonicalize with realpathSync so a symlink whose
	// target escapes the root can't pass a purely lexical prefix check; fall back
	// to lexical resolution for paths that don't exist yet (a non-existent target
	// can't be a symlink pointing out of tree). Reject anything that escapes.
	const canonicalize = (p: string): string => {
		try {
			return realpathSync(p);
		} catch {
			return resolve(p);
		}
	};
	const root = canonicalize(fallbackCwd);
	const within = (abs: string): boolean => abs === root || abs.startsWith(`${root}${sep}`);
	const cwd = canonicalize(args.cwd ?? fallbackCwd);
	if (!within(cwd)) {
		throw new Error(`cwd escapes the workspace root: ${args.cwd}`);
	}
	const rawPaths = args.paths && args.paths.length > 0 ? args.paths : ["."];
	const paths = rawPaths.map((p) => {
		const lexical = resolve(cwd, p);
		if (!within(canonicalize(lexical))) {
			throw new Error(`path escapes the workspace root: ${p}`);
		}
		return relative(cwd, lexical) || ".";
	});
	const doWrite = Boolean(args.write || args.unsafe);

	const biomeCmd = Lint.Biome.findBiome();
	if (!biomeCmd) {
		throw new Error("Biome not found. Install @biomejs/biome globally (recommended) or as a devDependency.");
	}
	// `findBiome()` returns "biome", or a package-manager exec form whose final
	// token is always the tool name: "pnpm exec biome", "npx --no biome",
	// "bun x --no-install biome". Splitting on spaces and running parts[0] with
	// parts.slice(1) as the prefix yields a valid invocation in every case (the
	// exec verb + its flags stay ahead of the biome subcommand). `findTool`
	// rejects names with spaces, so a space here is always an argv separator,
	// never part of a path. If `findBiome()`'s output format changes, revisit.
	const parts = biomeCmd.split(" ");
	const bin = parts[0];
	const prefix = parts.slice(1);
	const maxBuffer = 64 * 1024 * 1024;
	// Hard cap so a hung Biome process (password prompt, deadlock, stalled watcher)
	// can't block the MCP server; spawnSync sets result.error to ETIMEDOUT, which
	// the existing `throw *.error` checks surface.
	const timeout = 120_000;
	const killSignal = "SIGKILL" as const;

	let wrote = false;
	if (doWrite) {
		const writeArgs = [
			...prefix,
			mode,
			"--write",
			...(args.unsafe ? ["--unsafe"] : []),
			"--no-errors-on-unmatched",
			...paths,
		];
		const fix = spawnSync(bin, writeArgs, { cwd, encoding: "utf8", maxBuffer, timeout, killSignal });
		if (fix.error) throw fix.error;
		if ((fix.status ?? 0) > 1) {
			throw new Error(`Biome --write failed (exit ${fix.status}): ${(fix.stderr ?? "").trim() || "unknown error"}`);
		}
		wrote = true;
	}

	const readArgs = [...prefix, mode, "--reporter=gitlab", "--error-on-warnings", "--no-errors-on-unmatched", ...paths];
	const read = spawnSync(bin, readArgs, { cwd, encoding: "utf8", maxBuffer, timeout, killSignal });
	if (read.error) throw read.error;
	if ((read.status ?? 0) > 1) {
		throw new Error(`Biome failed (exit ${read.status}): ${(read.stderr ?? "").trim() || "unknown error"}`);
	}

	return buildBiomeResult({ diagnostics: parseBiomeGitlab(read.stdout ?? ""), wrote });
};
