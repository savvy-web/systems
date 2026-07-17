import type { Effect } from "effect";
import { Context } from "effect";
import type { LooseFiles } from "../build/loose-files.js";
import type { ConfigValidationError } from "../errors.js";
import type { ExeConfig } from "../exe/config.js";
import type { MetaOptions } from "../meta/config.js";
import type { PublishTargets } from "../targets/config.js";

/**
 * The normalized facts the validator checks, assembled by the bundler before any build work.
 *
 * @public
 */
export interface ValidationInput {
	readonly baseName: string;
	/** Whether the package declares an exports map (for the model-without-exports cross-field rule). */
	readonly hasExports: boolean;
	readonly targets?: PublishTargets | undefined;
	readonly exe?: ExeConfig | ReadonlyArray<ExeConfig> | undefined;
	readonly osCpu?: { readonly os: ReadonlyArray<string>; readonly cpu: ReadonlyArray<string> } | undefined;
	readonly meta?: MetaOptions | undefined;
	/** Standalone bundled output files; validated structurally (extension/format) before any build. */
	readonly looseFiles?: LooseFiles | undefined;
}

/**
 * Fast-fail config validator; runs first in the bundler over the resolved config.
 *
 * @public
 */
export class ConfigValidator extends Context.Service<
	ConfigValidator,
	{ readonly validate: (input: ValidationInput) => Effect.Effect<void, ConfigValidationError> }
>()("@savvy-web/tsdown-plugins/ConfigValidator") {}
