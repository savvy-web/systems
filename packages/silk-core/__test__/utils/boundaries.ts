/**
 * The policy behind `boundaries.test.ts` — the L1 gate that keeps
 * `@savvy-web/silk-core` platform-free.
 *
 * Lexing is the kit's: `SourceBoundary` from `@effected/workspaces/testing`
 * separates code from comments and string/template/regex literals, so a
 * `process` mention inside a string or comment is not a false positive and
 * `process["env"]` or a destructuring read is not a false negative. This
 * module keeps only what is silk-core's own decision: which module specifiers
 * count as reaching the platform.
 */

import { builtinModules } from "node:module";
import { SourceBoundary } from "@effected/workspaces/testing";

/**
 * Every module specifier the source names, in any import/export/require form,
 * deduplicated. Comments, template text and regex bodies are ignored.
 */
export const extractSpecifiers = (source: string): ReadonlyArray<string> => [
	...new Set(SourceBoundary.importSpecifiers(source)),
];

const BUILTINS: ReadonlySet<string> = new Set(builtinModules);

/**
 * Whether a specifier reaches the platform: a `node:` module, a bare Node
 * builtin (`fs`, `fs/promises`, `process`), `@effect/platform*`, or
 * `effect/process`.
 */
export const isForbiddenSpecifier = (specifier: string): boolean =>
	specifier.startsWith("node:") ||
	BUILTINS.has(specifier) ||
	BUILTINS.has(specifier.split("/")[0] as string) ||
	specifier === "process" ||
	specifier.startsWith("@effect/platform") ||
	specifier === "effect/process" ||
	specifier.startsWith("effect/process/");

/** Forbidden specifiers the source names. */
export const forbiddenSpecifiers = (source: string): ReadonlyArray<string> =>
	extractSpecifiers(source).filter(isForbiddenSpecifier);

/**
 * Whether the source touches the global `process` in code — a member read
 * (`process.env`, `process["env"]`), a destructuring (`const { env } = process`),
 * a bare pass-through, an interpolation, or `globalThis.process` /
 * `global.process`. A property named `process` on any other object
 * (`foo.process`) is not flagged; neither is a mention inside a string,
 * template text, regex or comment.
 */
export const readsProcess = (source: string): boolean => SourceBoundary.referencesProcess(source);
