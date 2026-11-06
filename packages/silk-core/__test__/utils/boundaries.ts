/**
 * The policy behind `boundaries.test.ts` — the L1 gate that keeps
 * `@savvy-web/silk-core` platform-free.
 *
 * Lexing is the kit's: `SourceBoundary` from `@effected/workspaces/testing`
 * separates code from comments and string/template/regex literals, so a
 * `process` mention inside a string or comment is not a false positive and
 * `process["env"]` or a destructuring read is not a false negative. This
 * module keeps only what is silk-core's own decision: core's `effect/process`
 * reaches the platform too, on top of the kit's `SourceBoundary.platformFree`.
 */

import { builtinModules } from "node:module";
import { SourceBoundary } from "@effected/workspaces/testing";

/** A `node:` module, a bare Node builtin (`fs`, `fs/promises`, `process`), `@effect/platform*`, or `effect/process`. */
const PLATFORM_RULES = [SourceBoundary.platformFree(builtinModules), { forbidImports: ["effect/process"] }];

/**
 * Forbidden specifiers the source names in any import/export/require form, one entry per occurrence.
 * Comments, template text and regex bodies are ignored.
 */
export const forbiddenSpecifiers = (source: string): ReadonlyArray<string> =>
	SourceBoundary.check("source", source, PLATFORM_RULES).map((offence) => offence.detail);

/** Whether a specifier reaches the platform. */
export const isForbiddenSpecifier = (specifier: string): boolean =>
	forbiddenSpecifiers(`import ${JSON.stringify(specifier)};`).length > 0;

/**
 * Whether the source touches the global `process` in code — a member read
 * (`process.env`, `process["env"]`), a destructuring (`const { env } = process`),
 * a bare pass-through, an interpolation, or `globalThis.process` /
 * `global.process`. A property named `process` on any other object
 * (`foo.process`) is not flagged; neither is a mention inside a string,
 * template text, regex or comment.
 */
export const readsProcess = (source: string): boolean => SourceBoundary.referencesProcess(source);
