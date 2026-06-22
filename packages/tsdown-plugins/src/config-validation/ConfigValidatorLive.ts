import { existsSync, statSync } from "node:fs";
import { Effect, Layer } from "effect";
import { normalizeLooseFiles } from "../build/loose-files.js";
import { ConfigValidationError } from "../errors.js";
import { normalizeExeOptions } from "../exe/config.js";
import { resolveTargets } from "../targets/resolve-targets.js";
import type { ValidationInput } from "./ConfigValidator.js";
import { ConfigValidator } from "./ConfigValidator.js";

const VALID_SYNTAX_KINDS = new Set(["block", "inline", "modifier"]);

/** Synchronous rule set; throws ConfigValidationError on the first violation. */
function check(input: ValidationInput): void {
	// Targets — delegate to resolveTargets (single source of truth; it throws ConfigValidationError).
	if (input.targets !== undefined && Object.keys(input.targets).length > 0) {
		resolveTargets({ targets: input.targets, baseName: input.baseName });
	}

	// Exe — fileName present and non-empty; targets non-empty after inference.
	if (input.exe !== undefined) {
		const specs = normalizeExeOptions(input.exe, input.osCpu ?? { os: [], cpu: [] });
		for (const spec of specs) {
			if (spec.fileName.trim() === "") {
				throw new ConfigValidationError({ path: "exe.fileName", reason: "an exe binary needs a non-empty fileName" });
			}
			if (spec.targets.length === 0) {
				throw new ConfigValidationError({
					path: `exe.${spec.fileName}.targets`,
					reason: "no targets: the package declares no os/cpu and the exe config states none",
				});
			}
		}
	}

	// Meta — tagDefinitions syntaxKind valid; localPaths that exist must be directories.
	if (input.meta !== undefined) {
		// Prerequisite guard: a package with no exports cannot emit a model, so fail fast before validating the rest of the meta config.
		if (!input.hasExports) {
			throw new ConfigValidationError({
				path: "meta",
				reason: "meta requires an exports map to extract an api-model from",
			});
		}
		for (const tag of input.meta.tsdoc?.tagDefinitions ?? []) {
			if (!VALID_SYNTAX_KINDS.has(tag.syntaxKind)) {
				throw new ConfigValidationError({
					path: "meta.tsdoc.tagDefinitions",
					reason: `tag "${tag.tagName}" has an invalid syntaxKind "${tag.syntaxKind}"`,
				});
			}
		}
		for (const p of input.meta.localPaths ?? []) {
			if (existsSync(p) && !statSync(p).isDirectory()) {
				throw new ConfigValidationError({ path: "meta.localPaths", reason: `"${p}" exists but is not a directory` });
			}
		}
	}

	// looseFiles — structural validation only (extension/format). normalizeLooseFiles throws
	// ConfigValidationError on any problem; the Live wrapper surfaces it as a typed failure.
	if (input.looseFiles !== undefined) {
		normalizeLooseFiles(input.looseFiles);
	}
}

/**
 * Live ConfigValidator: wraps the synchronous rule set, surfacing ConfigValidationError as a typed Effect failure.
 *
 * @public
 */
export const ConfigValidatorLive = Layer.succeed(ConfigValidator, {
	validate: (input) =>
		Effect.try({
			try: () => check(input),
			catch: (e) =>
				e instanceof ConfigValidationError ? e : new ConfigValidationError({ path: "config", reason: String(e) }),
		}),
});
