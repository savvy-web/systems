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
import { Schema, SchemaGetter } from "effect";

/** Normalized diagnostic severity. */
export const BiomeSeverity = Schema.Literals(["error", "warning", "info"]);

/** A single normalized Biome diagnostic. */
export const BiomeDiagnostic = Schema.Struct({
	file: Schema.String,
	line: Schema.Number,
	severity: BiomeSeverity,
	rule: Schema.String,
	message: Schema.String,
	/** Present only when `strict` upgraded this diagnostic; holds the project-configured severity. */
	originalSeverity: Schema.optional(BiomeSeverity),
}).annotate({ identifier: "BiomeDiagnostic" });

export type BiomeDiagnosticType = Schema.Schema.Type<typeof BiomeDiagnostic>;

/** The `biome_check` tool result. */
export const BiomeCheckResult = Schema.Struct({
	summary: Schema.Struct({
		errors: Schema.Number,
		warnings: Schema.Number,
		/** Count of project-level warnings reported as errors because `strict` was set. */
		upgradedWarnings: Schema.optional(Schema.Number),
	}),
	diagnostics: Schema.Array(BiomeDiagnostic),
	wrote: Schema.Boolean,
	guidance: Schema.String,
}).annotate({
	identifier: "BiomeCheckResult",
	title: "biome_check result",
	description: "Structured Biome diagnostics, with a flag for whether a --write pass ran.",
});

export type BiomeCheckResultType = Schema.Schema.Type<typeof BiomeCheckResult>;

/** Guardrail shown to the agent so it fixes code rather than silencing rules. */
const GUIDANCE_ERRORS = "Fix the actual code. Do NOT disable rules or add config overrides to silence these.";

/** Guidance when only project-tolerated warnings remain (default, non-strict run). */
const GUIDANCE_WARNINGS =
	"These are warnings under the project's Biome config — the project's own lint passes and they do not block commits or CI. Fix them when they sit in code you are already changing; do not churn unrelated files to silence them, and do NOT disable rules.";

/** Suffix appended when strict mode upgraded project warnings to errors. */
const GUIDANCE_STRICT_NOTE =
	"Diagnostics marked with originalSeverity are project-level warnings surfaced strictly by this run — they are not CI blockers.";

/** Shape of a single diagnostic in Biome's `--reporter=gitlab` output. */
const GitlabDiagnostic = Schema.Struct({
	description: Schema.String,
	check_name: Schema.String,
	severity: Schema.Literals(["info", "minor", "major", "critical", "blocker"]),
	location: Schema.Struct({ path: Schema.String, lines: Schema.Struct({ begin: Schema.Number }) }),
});
const GitlabArray = Schema.Array(GitlabDiagnostic);
const decodeGitlab = Schema.decodeUnknownSync(GitlabArray);

/**
 * Map a gitlab severity back onto the Biome severity it was produced from.
 *
 * @remarks Biome's gitlab reporter encodes its own `Severity` onto GitLab's
 * codequality scale (`crates/biome_cli/src/reporter/gitlab.rs`):
 * `Hint => info`, `Information => minor`, `Warning => major`, `Error => critical`,
 * `Fatal => blocker`. This function is the exact inverse. Reading `major` as an
 * error (as this did before systems#516) reports every diagnostic one step more
 * severe than the project's own `biome check` does, turning a green repo red.
 */
const mapSeverity = (s: "info" | "minor" | "major" | "critical" | "blocker"): "error" | "warning" | "info" =>
	s === "info" || s === "minor" ? "info" : s === "major" ? "warning" : "error";

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
	strict?: boolean;
}): BiomeCheckResultType => {
	// Strict mode upgrades project warnings to errors IN-PROCESS (never via
	// --error-on-warnings) so the pre-upgrade severity survives on the diagnostic
	// and the summary can distinguish real errors from surfaced warnings.
	const diagnostics = params.strict
		? params.diagnostics.map((d) =>
				d.severity === "warning" ? { ...d, severity: "error" as const, originalSeverity: "warning" as const } : d,
			)
		: [...params.diagnostics];
	const upgradedWarnings = diagnostics.filter((d) => d.originalSeverity === "warning").length;
	const errors = diagnostics.filter((d) => d.severity === "error").length;
	const warnings = diagnostics.filter((d) => d.severity === "warning").length;
	const realErrors = errors - upgradedWarnings;
	const guidance =
		realErrors > 0
			? params.strict && upgradedWarnings > 0
				? `${GUIDANCE_ERRORS} ${GUIDANCE_STRICT_NOTE}`
				: GUIDANCE_ERRORS
			: upgradedWarnings > 0
				? `${GUIDANCE_WARNINGS} ${GUIDANCE_STRICT_NOTE}`
				: GUIDANCE_WARNINGS;
	return {
		summary: params.strict ? { errors, warnings, upgradedWarnings } : { errors, warnings },
		diagnostics,
		wrote: params.wrote,
		guidance: diagnostics.length === 0 ? GUIDANCE_ERRORS : guidance,
	};
};

/** Render the structured result as markdown. */
const renderMarkdown = (data: BiomeCheckResultType): string => {
	if (data.diagnostics.length === 0) {
		const wroteNote = data.wrote ? " A --write pass ran; check `git diff` for what changed." : "";
		return `# biome — clean\n\n✅ No remaining diagnostics.${wroteNote}`;
	}
	const upgraded = data.summary.upgradedWarnings ?? 0;
	const upgradedNote = upgraded > 0 ? ` (${upgraded} strict-upgraded from project warnings)` : "";
	const lines = [`# biome — ${data.summary.errors} error(s)${upgradedNote}, ${data.summary.warnings} warning(s)`, ``];
	if (data.wrote) lines.push(`A --write pass ran; the diagnostics below remain unfixed.`, ``);
	for (const d of data.diagnostics) {
		const severity = d.originalSeverity ? `${d.severity} (project ${d.originalSeverity}, strict)` : d.severity;
		lines.push(`- \`${d.file}:${d.line}\` **${severity}** ${d.rule} — ${d.message}`);
	}
	lines.push(``, `---`, data.guidance);
	return lines.join("\n");
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const BiomeCheckAsMarkdown = BiomeCheckResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "BiomeCheckAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

/**
 * Canonicalize a path, falling back to lexical resolution when it does not exist
 * (a non-existent target cannot be a symlink pointing out of tree).
 */
const canonicalize = (p: string): string => {
	try {
		return realpathSync(p);
	} catch {
		return resolve(p);
	}
};

/** What {@link resolveContainmentRoot} needs to know about a directory's git identity. */
export interface GitWorktreeIdentity {
	/** The shared git dir — identical across every worktree of one repository. */
	readonly commonDir: string;
	/** The top level of the specific worktree the directory belongs to. */
	readonly topLevel: string;
}

/** Probe a directory's git identity. Returns null when it is not inside a repository. */
export type GitWorktreeProbe = (dir: string) => GitWorktreeIdentity | null;

/** Real git probe. One `rev-parse` yielding both paths already absolute. */
const gitWorktreeProbe: GitWorktreeProbe = (dir) => {
	const res = spawnSync(
		"git",
		["-C", dir, "rev-parse", "--path-format=absolute", "--git-common-dir", "--show-toplevel"],
		{
			encoding: "utf8",
			timeout: 10_000,
		},
	);
	if (res.error || (res.status ?? 1) !== 0) return null;
	const [commonDir, topLevel] = (res.stdout ?? "").trim().split("\n");
	if (!commonDir || !topLevel) return null;
	return { commonDir: canonicalize(commonDir.trim()), topLevel: canonicalize(topLevel.trim()) };
};

/**
 * Decide which directory tree this run may touch.
 *
 * @remarks A cwd inside the server's root keeps that root. A cwd OUTSIDE it is
 * accepted only when it belongs to a DIFFERENT worktree of the same repository —
 * a shared git common dir but a different top level — and containment then follows
 * that worktree rather than the server's start directory (systems#482). Binding to the start directory
 * meant a call from a sibling worktree silently mutated the main checkout, which in
 * a parallel multi-agent session is another agent's tree. Returns null to reject.
 *
 * @param root - the server's workspace root, already canonicalized
 * @param cwd - the requested working directory, already canonicalized
 * @param probe - git identity probe; injectable for tests
 * @returns the directory tree to contain to, or null if the cwd must be rejected
 */
export const resolveContainmentRoot = (
	root: string,
	cwd: string,
	probe: GitWorktreeProbe = gitWorktreeProbe,
): string | null => {
	if (cwd === root || cwd.startsWith(`${root}${sep}`)) return root;
	const from = probe(cwd);
	if (!from) return null;
	const home = probe(root);
	if (!home) return null;
	if (from.commonDir !== home.commonDir) return null;
	// Same repository — but that alone does not earn a wider tree. When the two
	// share a top level, `root` is a strict subdirectory of its own worktree (dev
	// tooling launches the server from packages/mcp/), and the cwd is simply
	// elsewhere in that same checkout. Widening to the top level there would hand
	// a --write pass the entire repo, including the .repos/** vendored trees, for
	// a request that was rejected before worktree support existed. Only a genuinely
	// different worktree gets its own tree.
	if (from.topLevel === home.topLevel) return null;
	return from.topLevel;
};

/** Arguments for the {@link runBiomeCheck} handler. */
export interface BiomeCheckArgs {
	readonly paths?: readonly string[];
	readonly mode?: "check" | "lint";
	readonly write?: boolean;
	readonly unsafe?: boolean;
	readonly cwd?: string;
	/** Report project warnings as errors (marked with originalSeverity). Default: honor the project config. */
	readonly strict?: boolean;
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

	// Containment: this is a mutating tool, so keep cwd and every target path inside
	// one tree. Canonicalize with realpathSync so a symlink whose target escapes
	// can't pass a purely lexical prefix check. The tree is the server's root, or —
	// when cwd names a worktree of the same repository — that worktree (systems#482).
	const root = canonicalize(fallbackCwd);
	const cwd = canonicalize(args.cwd ?? fallbackCwd);
	const containmentRoot = resolveContainmentRoot(root, cwd);
	if (containmentRoot === null) {
		throw new Error(`cwd escapes the workspace root: ${args.cwd}`);
	}
	const within = (abs: string): boolean => abs === containmentRoot || abs.startsWith(`${containmentRoot}${sep}`);
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

	// No --error-on-warnings here: the read pass honors the project config's
	// severities so this tool agrees with the project's own `biome check`.
	// Strict upgrading happens in-process (buildBiomeResult) so the original
	// severity is preserved on each diagnostic.
	const readArgs = [...prefix, mode, "--reporter=gitlab", "--no-errors-on-unmatched", ...paths];
	const read = spawnSync(bin, readArgs, { cwd, encoding: "utf8", maxBuffer, timeout, killSignal });
	if (read.error) throw read.error;
	if ((read.status ?? 0) > 1) {
		throw new Error(`Biome failed (exit ${read.status}): ${(read.stderr ?? "").trim() || "unknown error"}`);
	}

	return buildBiomeResult({
		diagnostics: parseBiomeGitlab(read.stdout ?? ""),
		wrote,
		...(args.strict !== undefined ? { strict: args.strict } : {}),
	});
};
