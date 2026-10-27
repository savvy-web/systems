/**
 * The `biome_check` MCP tool: a thin proxy that runs Biome over a path with the
 * gitlab reporter, parses it into a typed result, and can apply fixes. Unlike the
 * other savvy-mcp tools this one MUTATES the working tree when `write`/`unsafe`
 * is set — the first intentional exception to the read-only convention.
 *
 * @packageDocumentation
 */

import { realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { Tool as CommandTool, Run, ToolDiscovery } from "@effected/commands";
import type { Exclusive, Remediation } from "@effected/engine";
import type { GitShape } from "@effected/git";
import { Git, TreeIdentity } from "@effected/git";
import { ToolFailure, ToolRefusal } from "@effected/mcp";
import { Effect, Option, Schema } from "effect";
import { Tool } from "effect/ai";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { BiomeFailed, McpToolError } from "../errors.js";

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

/**
 * Canonicalize a caller-supplied path, falling back to lexical resolution when
 * it does not exist (a non-existent target cannot be a symlink pointing out of
 * tree). Git's own answers (`TreeIdentity`) are already physical and are never
 * passed through here.
 */
const canonicalize = (p: string): string => {
	try {
		return realpathSync(p);
	} catch {
		return resolve(p);
	}
};

/**
 * The working-tree identity of `dir`, or `Option.none` when it is in no
 * working tree. A git failure (git missing, too old for `--path-format`) also
 * answers `none`: the caller then rejects the cwd, which is what an unknown
 * identity must mean for a mutating tool.
 */
const treeIdentity = (git: GitShape, dir: string): Effect.Effect<Option.Option<TreeIdentity>> =>
	git.treeIdentity(dir).pipe(Effect.orElseSucceed(() => Option.none<TreeIdentity>()));

/**
 * Decide which directory tree this run may touch.
 *
 * @remarks A cwd inside the server's root keeps that root. A cwd OUTSIDE it is
 * accepted only when it belongs to a DIFFERENT worktree of the same repository
 * (`TreeIdentity.relation` answers `"sibling-worktree"`), and containment then
 * follows that worktree's toplevel rather than the server's start directory
 * (systems#482). Binding to the start directory meant a call from a sibling
 * worktree silently mutated the main checkout, which in a parallel multi-agent
 * session is another agent's tree.
 *
 * `"same-tree"` is rejected: `root` can be a strict subdirectory of its own
 * worktree (dev tooling launches the server from packages/mcp/), and a cwd
 * elsewhere in that same checkout must not widen a --write pass to the whole
 * repo, including the .repos/** vendored trees. `"different-repo"`, or either
 * directory being in no working tree, is rejected too.
 *
 * @param root - the server's workspace root, already canonicalized
 * @param cwd - the requested working directory, already canonicalized
 * @returns the directory tree to contain to, or `Option.none` to reject
 */
export const resolveContainmentRoot = Effect.fn("biome_check.resolveContainmentRoot")(function* (
	root: string,
	cwd: string,
) {
	if (cwd === root || cwd.startsWith(`${root}${sep}`)) return Option.some(root);
	const git = yield* Git;
	const from = yield* treeIdentity(git, cwd);
	if (Option.isNone(from)) return Option.none<string>();
	const home = yield* treeIdentity(git, root);
	if (Option.isNone(home)) return Option.none<string>();
	return TreeIdentity.relation(from.value, home.value) === "sibling-worktree"
		? Option.some(canonicalize(from.value.toplevel))
		: Option.none<string>();
});

/** Remediation for a path or cwd that escapes the containment tree. */
const CONTAINMENT_REMEDIATION: Remediation = {
	hint: "Keep cwd and every path inside the server's workspace root, or inside a git worktree of the same repository.",
};

/** Remediation when no Biome binary can be located. */
const BIOME_REMEDIATION: Remediation = {
	hint: "Install @biomejs/biome globally (recommended) or as a devDependency of the workspace.",
};

/** Remediation when Biome itself fails (not "lint issues found", which is a result). */
const BIOME_FAILED_REMEDIATION: Remediation = {
	hint: "Biome did not complete; the message carries its stderr. Fix the configuration or invocation and retry.",
};

/** Build a {@link BiomeFailed} from a spawn error or a non-lint exit status. */
const biomeFailed = (raw: string, exitCode?: number): BiomeFailed =>
	new BiomeFailed({
		...(exitCode === undefined ? {} : { exitCode }),
		message: ToolFailure.message(raw, BIOME_FAILED_REMEDIATION),
		remediation: BIOME_FAILED_REMEDIATION,
	});

/**
 * The Biome tool, global copy first — the same lookup order as silk-effects'
 * `Lint.Biome.findBiome` (`Command.findTool` resolves
 * `Tool.named(name, { prefer: "global" })`). One module-level value, so every
 * call hits the same `ToolDiscovery` probe-cache entry.
 */
const BIOME_TOOL = CommandTool.named("biome", { prefer: "global" });

/** Per-stream captured-output ceiling for one Biome run. */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/**
 * Hard cap so a hung Biome process (password prompt, deadlock, stalled
 * watcher) can't block the MCP server. Expiry fails the run as a
 * `CommandFailedError` of kind `"timeout"`.
 */
const BIOME_TIMEOUT = "120 seconds";

/**
 * Backstop on the write lane, a little above {@link BIOME_TIMEOUT} so the run's
 * own typed timeout fires first; the lane only bounds how long one write may
 * hold the permit, never the wait for it.
 */
const WRITE_LANE_TIMEOUT = "125 seconds";

/**
 * Re-scope a resolved Biome command to the request's `cwd` (a local
 * resolution is scoped to the server's root by its `ExecContext`; paths are
 * relative to `cwd`) and kill it with `SIGKILL` on timeout — core's default
 * `SIGTERM` with no `forceKillAfter` would wait on a child that ignores it.
 */
const scoped = (command: ChildProcess.Command, cwd: string): ChildProcess.Command =>
	command._tag === "StandardCommand"
		? ChildProcess.make(command.command, command.args, { ...command.options, cwd, killSignal: "SIGKILL" })
		: ChildProcess.setCwd(command, cwd);

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
 * @remarks Resolves the Biome binary through `ToolDiscovery` (global first,
 * then the project's package manager — {@link BIOME_TOOL}) and runs it with
 * `Run.collect`. Fails with a {@link McpToolError} member: a `ToolRefusal` for
 * a cwd/path outside the containment tree or when no binary resolves,
 * {@link BiomeFailed} when Biome exits with status > 1 (Biome itself failed,
 * vs. status 1 = lint issues found), cannot spawn, times out, or overflows the
 * output cap. The write pass runs on `lane`, one permit per server, so two
 * concurrent write calls never interleave on a tree.
 *
 * @param args - the decoded tool parameters
 * @param fallbackCwd - the server's project directory
 * @param lane - the server's write lane
 */
export const runBiomeCheck = Effect.fn("biome_check.run")(function* (
	args: BiomeCheckArgs,
	fallbackCwd: string,
	lane: Exclusive,
) {
	const mode = args.mode ?? "check";

	// Containment: this is a mutating tool, so keep cwd and every target path inside
	// one tree. Canonicalize caller paths with realpathSync so a symlink whose target
	// escapes can't pass a purely lexical prefix check. The tree is the server's
	// root, or — when cwd names a worktree of the same repository — that worktree
	// (systems#482).
	const root = canonicalize(fallbackCwd);
	const cwd = canonicalize(args.cwd ?? fallbackCwd);
	const contained = yield* resolveContainmentRoot(root, cwd);
	if (Option.isNone(contained)) {
		return yield* ToolRefusal.refuse(
			`cwd escapes the workspace root: ${ToolFailure.truncate(args.cwd ?? fallbackCwd)}.`,
			CONTAINMENT_REMEDIATION,
		);
	}
	const containmentRoot = contained.value;
	const within = (abs: string): boolean => abs === containmentRoot || abs.startsWith(`${containmentRoot}${sep}`);
	const rawPaths = args.paths && args.paths.length > 0 ? args.paths : ["."];
	const paths: string[] = [];
	for (const p of rawPaths) {
		const lexical = resolve(cwd, p);
		if (!within(canonicalize(lexical))) {
			return yield* ToolRefusal.refuse(
				`path escapes the workspace root: ${ToolFailure.truncate(p)}.`,
				CONTAINMENT_REMEDIATION,
			);
		}
		paths.push(relative(cwd, lexical) || ".");
	}
	const doWrite = Boolean(args.write || args.unsafe);

	const discovery = yield* ToolDiscovery;
	const biome = yield* discovery
		.resolve(BIOME_TOOL)
		.pipe(
			Effect.mapError((error) =>
				error._tag === "ToolNotFoundError"
					? ToolRefusal.refuse("Biome not found.", BIOME_REMEDIATION)
					: ToolRefusal.refuse(`Biome could not be resolved: ${error.message}`, BIOME_REMEDIATION),
			),
		);

	/** One Biome pass; exit 0/1 is a result, anything else a {@link BiomeFailed}. */
	const pass = (label: string, argv: ReadonlyArray<string>) =>
		Run.collect(scoped(biome.command(...argv), cwd), { timeout: BIOME_TIMEOUT, maxOutputBytes: MAX_OUTPUT_BYTES }).pipe(
			Effect.mapError((error) => biomeFailed(`${label} could not run: ${error.message}`, error.exitCode)),
			Effect.flatMap((output) =>
				output.exitCode > 1
					? Effect.fail(
							biomeFailed(
								`${label} failed (exit ${output.exitCode}): ${output.stderr.trim() || "unknown error"}`,
								output.exitCode,
							),
						)
					: Effect.succeed(output),
			),
		);

	let wrote = false;
	if (doWrite) {
		const writeArgs = [mode, "--write", ...(args.unsafe ? ["--unsafe"] : []), "--no-errors-on-unmatched", ...paths];
		yield* lane
			.run(pass("Biome --write", writeArgs), { timeout: WRITE_LANE_TIMEOUT })
			.pipe(
				Effect.catchTag("ExclusiveTimeout", (timeout) =>
					Effect.fail(biomeFailed(`Biome --write did not finish: ${timeout.message}`)),
				),
			);
		wrote = true;
	}

	// No --error-on-warnings here: the read pass honors the project config's
	// severities so this tool agrees with the project's own `biome check`.
	// Strict upgrading happens in-process (buildBiomeResult) so the original
	// severity is preserved on each diagnostic.
	const read = yield* pass("Biome", [mode, "--reporter=gitlab", "--no-errors-on-unmatched", ...paths]);

	return buildBiomeResult({
		diagnostics: parseBiomeGitlab(read.stdout),
		wrote,
		...(args.strict !== undefined ? { strict: args.strict } : {}),
	});
});

/** Wire parameters for `biome_check`. */
export const BiomeCheckParams = Schema.Struct({
	paths: Schema.optionalKey(
		Schema.Array(Schema.String).annotate({ description: "Paths to check. Defaults to the whole workspace." }),
	),
	mode: Schema.optionalKey(
		Schema.Literals(["check", "lint"]).annotate({
			description: "check = lint+format+imports (default); lint = lint only.",
		}),
	),
	write: Schema.optionalKey(Schema.Boolean.annotate({ description: "Apply safe fixes (--write)." })),
	unsafe: Schema.optionalKey(
		Schema.Boolean.annotate({ description: "Apply unsafe fixes (--write --unsafe); implies write." }),
	),
	strict: Schema.optionalKey(
		Schema.Boolean.annotate({
			description: "Report project warnings as errors (marked with originalSeverity). Default: honor project config.",
		}),
	),
	cwd: Schema.optionalKey(
		Schema.String.annotate({
			description:
				"Directory to run from. May be the server's workspace root, a directory inside it, or a git worktree of the SAME repository — a worktree contains the run to that worktree instead of the main checkout. Anything else is rejected.",
		}),
	),
});
export type BiomeCheckParams = typeof BiomeCheckParams.Type;

/**
 * The `biome_check` tool value. Mutating when `write`/`unsafe` is set, so it is
 * annotated non-read-only and non-idempotent. `dependencies` lists what the
 * handler yields: `Git` (worktree containment), `ToolDiscovery` (the Biome
 * binary) and core's `ChildProcessSpawner` (`Run.collect`).
 */
export const biomeCheckTool = Tool.make("biome_check", {
	description:
		"Run Biome over a path and get structured diagnostics back. mode=check (default; lint + format + organize-imports) or mode=lint. Set write=true to apply safe fixes (--write), unsafe=true for unsafe fixes (--write --unsafe). Severities match the project's Biome config (what `biome check` reports); set strict=true to surface project warnings as errors, each marked with its originalSeverity. Prefer this over shelling out to biome; the LSP already covers files you've edited. Returns a typed object in structuredContent (content[] carries the same object as JSON). NOTE: with write/unsafe this tool MUTATES files (git-reversible).",
	parameters: BiomeCheckParams,
	success: BiomeCheckResult,
	failure: McpToolError,
	dependencies: [Git, ToolDiscovery, ChildProcessSpawner.ChildProcessSpawner],
})
	.annotate(Tool.Title, "Biome check")
	.annotate(Tool.Readonly, false)
	.annotate(Tool.Destructive, false)
	.annotate(Tool.Idempotent, false)
	.annotate(Tool.OpenWorld, false);

/**
 * Wire handler: {@link runBiomeCheck} with its error channel closed over
 * {@link McpToolError}. A defect (a bug in the parser, say) is reported as
 * {@link BiomeFailed} rather than reaching core, which would scrub it to a
 * generic internal-error text.
 *
 * @param fallbackCwd - the server's project directory
 * @param lane - the server's one write lane, built once in `ToolsLayer`
 */
export const handleBiomeCheck = (fallbackCwd: string, params: BiomeCheckParams, lane: Exclusive) =>
	runBiomeCheck(params, fallbackCwd, lane).pipe(
		Effect.catchDefect((defect) =>
			Effect.fail(biomeFailed(`Biome check failed: ${defect instanceof Error ? defect.message : String(defect)}`)),
		),
	);
