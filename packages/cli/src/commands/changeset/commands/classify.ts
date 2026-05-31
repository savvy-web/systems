/**
 * `classify` command -- map one or more paths to their owning package.
 *
 * @remarks
 * Wraps {@link ConfigInspector.classify}. Each path resolves to a package
 * via (in order): workspace match → `additionalScopes` glob → `versionFiles`
 * glob → `null` (unmapped).
 *
 * @example
 * ```bash
 * savvy-changesets classify packages/foo/src/index.ts plugin/SKILL.md
 * savvy-changesets classify --cwd ./monorepo plugin/x.md --json
 * ```
 *
 * @internal
 */

import { resolve } from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";

type Classification = Changesets.Classification;
const { ConfigInspector } = Changesets;

/* v8 ignore start -- CLI option definitions */
const pathsArg = Args.text({ name: "path" }).pipe(Args.repeated);
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
 * Format a single {@link Classification} as a human-readable line.
 *
 * @internal
 */
export function renderClassificationLine(c: Classification): string {
	if (c.package === null) {
		return `${c.path}\t<unmapped>`;
	}
	if (c.reason === "workspace") {
		return `${c.path}\t${c.package}\tworkspace`;
	}
	if (c.reason !== null) {
		return `${c.path}\t${c.package}\t${c.reason.kind}: ${c.reason.glob}`;
	}
	return `${c.path}\t${c.package}`;
}

/**
 * Resolve the cwd, invoke `ConfigInspector.classify`, and render the result.
 * Sets `process.exitCode = 1` on `ConfigurationError`.
 *
 * @internal
 */
export function runClassify(cwd: string, paths: ReadonlyArray<string>, json: boolean) {
	return Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		const resolvedCwd = resolve(cwd);
		const classifications = yield* inspector.classify(resolvedCwd, paths).pipe(
			Effect.catchTag("ConfigurationError", (err) => {
				process.exitCode = 1;
				return Effect.fail(err);
			}),
		);

		if (json) {
			yield* Effect.log(JSON.stringify(classifications, null, 2));
			return;
		}

		for (const c of classifications) {
			yield* Effect.log(renderClassificationLine(c));
		}
	});
}

/* v8 ignore next 6 -- CLI registration */
export const classifyCommand = Command.make(
	"classify",
	{ paths: pathsArg, cwd: cwdOption, json: jsonOption },
	({ paths, cwd, json }) => runClassify(cwd, paths, json),
).pipe(Command.withDescription("Map paths to their owning package per .changeset/config.json"));
