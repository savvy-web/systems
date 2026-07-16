// packages/tsdown-plugins/src/report/services/FormatSelector.ts
import type { Effect } from "effect";
import { Context } from "effect";
import type { Environment } from "./EnvironmentDetector.js";
import type { Executor } from "./ExecutorResolver.js";

/** @public */
export type OutputFormat = "terminal" | "json" | "markdown" | "ci-annotations" | "silent";

/** @public */
export class FormatSelector extends Context.Service<
	FormatSelector,
	{ readonly select: (executor: Executor, explicit?: OutputFormat, env?: Environment) => Effect.Effect<OutputFormat> }
>()("@savvy-web/tsdown-plugins/FormatSelector") {}
