/**
 * Fmt command - format files in-place for lint-staged staging.
 *
 * @remarks
 * These subcommands modify files via CLI commands rather than in handler
 * function bodies, so lint-staged can detect the modifications and
 * auto-stage them between array steps.
 *
 * @internal
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Yaml } from "@effected/yaml";
import { Lint } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";

/** Repeated file path arguments. */
const filesArg = Argument.file("files", { mustExist: true }).pipe(Argument.variadic());

/** Sort package.json files with sort-package-json. */
const packageJsonCommand = Command.make("package-json", { files: filesArg }, ({ files }) =>
	Effect.sync(() => {
		for (const filepath of files) {
			const content = readFileSync(filepath, "utf-8");
			const sorted = Lint.PackageJson.sortContent(content);
			if (sorted !== content) {
				writeFileSync(filepath, sorted, "utf-8");
			}
		}
	}),
);

/** Sort and format pnpm-workspace.yaml. */
const pnpmWorkspaceCommand = Command.make("pnpm-workspace", {}, () =>
	Effect.gen(function* () {
		const filepath = "pnpm-workspace.yaml";

		if (!existsSync(filepath)) {
			return;
		}

		const content = readFileSync(filepath, "utf-8");
		const parsed = (yield* Yaml.parse(content)) as Lint.PnpmWorkspaceContent;
		const sorted = Lint.PnpmWorkspace.sortContent(parsed);
		// Formatting lives in silk-effects so this path and the lint-staged
		// handler cannot drift; it normalizes @effected/yaml's unindented
		// sequences and single-quoted scalars back to the repo's byte format.
		const formatted = yield* Effect.promise(() => Lint.PnpmWorkspace.formatContent(sorted));
		writeFileSync(filepath, formatted, "utf-8");
	}),
);

/** Format YAML files with @effected/yaml. */
const yamlCommand = Command.make("yaml", { files: filesArg }, ({ files }) =>
	Effect.sync(() => {
		for (const filepath of files) {
			Lint.Yaml.formatFile(filepath);
		}
	}),
);

/** Parent fmt command with formatting subcommands. */
const _fmtCommand = Command.make("fmt").pipe(
	Command.withSubcommands([packageJsonCommand, pnpmWorkspaceCommand, yamlCommand]),
);

/**
 * The `savvy lint fmt` command group with package-json, pnpm-workspace, and yaml subcommands.
 *
 * @remarks
 * Typed as `unknown` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types. The cast is for declaration emit only.
 */
export const fmtCommand = _fmtCommand;
