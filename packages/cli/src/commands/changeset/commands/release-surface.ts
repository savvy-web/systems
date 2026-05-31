/**
 * `release-surface` command -- list every path owned by a named package.
 *
 * @remarks
 * For a given package name, emits the workspace directory, every
 * `additionalScopes` glob and its materialized files, and every
 * `versionFiles` entry and its targets. Useful for debugging "why is this
 * path attributed to this package?" or "what's actually in this package's
 * release surface right now?"
 *
 * @example
 * ```bash
 * savvy changeset release-surface @savvy-web/changesets
 * savvy changeset release-surface @scope/foo --json
 * ```
 *
 * @internal
 */

import { resolve } from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";

type ResolvedPackageScope = Changesets.ResolvedPackageScope;
const { ConfigInspector, ConfigurationError } = Changesets;

/* v8 ignore start -- CLI option definitions */
const packageArg = Args.text({ name: "package" });
const cwdOption = Options.directory("cwd").pipe(
	Options.withDescription("Project root (defaults to the current working directory)"),
	Options.withDefault("."),
);
const jsonOption = Options.boolean("json").pipe(
	Options.withDescription("Emit JSON instead of human-readable output"),
	Options.withDefault(false),
);
/* v8 ignore stop */

/**
 * Render a single package's resolved scope as human-readable text.
 *
 * @internal
 */
export function renderHuman(pkg: ResolvedPackageScope): string {
	const lines: string[] = [];
	lines.push(`Package:   ${pkg.name}  v${pkg.version}`);
	lines.push(`Workspace: ${pkg.workspaceDir}`);
	if (pkg.additionalScopes.length === 0 && pkg.versionFiles.length === 0) {
		lines.push("");
		lines.push("(no additionalScopes or versionFiles — workspace dir is the entire release surface)");
		return lines.join("\n");
	}

	if (pkg.additionalScopes.length > 0) {
		lines.push("");
		lines.push(
			`additionalScopes (${pkg.additionalScopes.length} glob${pkg.additionalScopes.length === 1 ? "" : "s"}):`,
		);
		for (const g of pkg.additionalScopes) lines.push(`  - ${g}`);
		lines.push(`Resolved files (${pkg.additionalScopeFiles.length}):`);
		for (const f of pkg.additionalScopeFiles) lines.push(`  ${f}`);
	}

	if (pkg.versionFiles.length > 0) {
		lines.push("");
		lines.push(`versionFiles (${pkg.versionFiles.length}):`);
		for (const vf of pkg.versionFiles) {
			lines.push(`  ${vf.glob} → ${vf.paths.join(", ")}`);
			for (const f of vf.matchedFiles) lines.push(`    ${f}`);
		}
	}
	return lines.join("\n");
}

/**
 * Resolve cwd, invoke `ConfigInspector.inspect`, find the named package's
 * scope, and render it. Sets `process.exitCode = 1` on any error.
 *
 * @internal
 */
export function runReleaseSurface(cwd: string, pkgName: string, json: boolean) {
	return Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		const resolvedCwd = resolve(cwd);
		const config = yield* inspector.inspect(resolvedCwd).pipe(
			Effect.catchTag("ConfigurationError", (err) => {
				process.exitCode = 1;
				return Effect.fail(err);
			}),
		);

		const scope = config.packages.find((p) => p.name === pkgName);
		if (!scope) {
			process.exitCode = 1;
			return yield* Effect.fail(
				new ConfigurationError({
					field: `packages["${pkgName}"]`,
					reason:
						`Package "${pkgName}" is not declared in .changeset/config.json#packages. ` +
						`Declared packages: ${config.packages.map((p) => p.name).join(", ") || "(none)"}.`,
				}),
			);
		}

		const output = json ? JSON.stringify(scope, null, 2) : renderHuman(scope);
		yield* Effect.log(output);
	});
}

/* v8 ignore next 6 -- CLI registration */
export const releaseSurfaceCommand = Command.make(
	"release-surface",
	{ package: packageArg, cwd: cwdOption, json: jsonOption },
	({ package: pkgName, cwd, json }) => runReleaseSurface(cwd, pkgName, json),
).pipe(Command.withDescription("Print every path owned by a package — workspace dir, additionalScopes, versionFiles"));
