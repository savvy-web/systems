/**
 * `config show` command -- emit the resolved `.changeset/config.json`.
 *
 * @remarks
 * Wraps {@link ConfigInspector.inspect} and renders either human-readable
 * output (default) or JSON (`--json` / `--format=json`). The same data shape
 * the agent consumes is what the user sees, so debugging an unexpected
 * classification result becomes a single `savvy changeset config show --json`
 * invocation.
 *
 * @example
 * ```bash
 * savvy changeset config show
 * savvy changeset config show --json
 * savvy changeset config show ./path/to/project --json
 * ```
 *
 * @internal
 */

import { resolve } from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";

type InspectedConfig = Changesets.InspectedConfig;
const { ConfigInspector } = Changesets;

/* v8 ignore start -- CLI option definitions */
const dirArg = Args.directory({ name: "dir" }).pipe(Args.withDefault("."));
const jsonOption = Options.boolean("json").pipe(
	Options.withDescription("Emit JSON instead of human-readable output"),
	Options.withDefault(false),
);
/* v8 ignore stop */

/**
 * Render an {@link InspectedConfig} as human-readable text.
 *
 * @internal
 */
export function renderHuman(config: InspectedConfig): string {
	const lines: string[] = [];
	lines.push(`Config:    ${config.configPath}`);
	lines.push(`Project:   ${config.projectDir}`);
	lines.push(`Changelog: ${config.changelog ?? "(none)"}`);
	lines.push(`Base:      ${config.baseBranch}`);
	lines.push(`Access:    ${config.access}`);
	if (config.ignore.length > 0) {
		lines.push(`Ignore:    ${config.ignore.join(", ")}`);
	}
	if (config.legacyVersionFilesUsed) {
		lines.push("");
		lines.push("⚠ This config still uses the deprecated top-level `versionFiles[]`.");
		lines.push("  Migrate to `packages[<name>].versionFiles` — required for 1.0.0.");
	}

	lines.push("");
	if (config.packages.length === 0) {
		lines.push("Packages: (none declared)");
		return lines.join("\n");
	}

	lines.push(`Packages (${config.packages.length}):`);
	for (const pkg of config.packages) {
		lines.push("");
		lines.push(`  ${pkg.name}  v${pkg.version}`);
		lines.push(`    workspace: ${pkg.workspaceDir}`);
		if (pkg.additionalScopes.length > 0) {
			lines.push(`    additionalScopes (${pkg.additionalScopes.length}):`);
			for (const g of pkg.additionalScopes) lines.push(`      - ${g}`);
			lines.push(`    additionalScopeFiles (${pkg.additionalScopeFiles.length}):`);
			for (const f of pkg.additionalScopeFiles) lines.push(`      ${f}`);
		}
		if (pkg.versionFiles.length > 0) {
			lines.push(`    versionFiles (${pkg.versionFiles.length}):`);
			for (const vf of pkg.versionFiles) {
				lines.push(
					`      ${vf.glob} → ${vf.paths.join(", ")}  (${vf.matchedFiles.length} file${vf.matchedFiles.length === 1 ? "" : "s"} matched)`,
				);
				for (const f of vf.matchedFiles) lines.push(`        ${f}`);
			}
		}
	}
	return lines.join("\n");
}

/**
 * Resolve the project dir, invoke `ConfigInspector.inspect`, and render the
 * result. Sets `process.exitCode = 1` on `ConfigurationError`.
 *
 * @internal
 */
export function runConfigShow(dir: string, json: boolean) {
	return Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		const resolved = resolve(dir);
		const config = yield* inspector.inspect(resolved).pipe(
			Effect.catchTag("ConfigurationError", (err) => {
				process.exitCode = 1;
				return Effect.fail(err);
			}),
		);

		const output = json ? JSON.stringify(config, null, 2) : renderHuman(config);
		yield* Effect.log(output);
	});
}

/* v8 ignore next 6 -- CLI registration */
export const configShowCommand = Command.make("show", { dir: dirArg, json: jsonOption }, ({ dir, json }) =>
	runConfigShow(dir, json),
).pipe(Command.withDescription("Print the resolved .changeset/config.json"));
