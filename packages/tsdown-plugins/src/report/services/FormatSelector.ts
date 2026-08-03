// packages/tsdown-plugins/src/report/services/FormatSelector.ts
import { Context, Effect, Layer } from "effect";
import type { Environment } from "./EnvironmentDetector.js";
import type { Executor } from "./ExecutorResolver.js";

/** @public */
export type OutputFormat = "terminal" | "json" | "markdown" | "ci-annotations" | "silent";

/** @public */
export class FormatSelector extends Context.Service<
	FormatSelector,
	{ readonly select: (executor: Executor, explicit?: OutputFormat, env?: Environment) => Effect.Effect<OutputFormat> }
>()("@savvy-web/tsdown-plugins/FormatSelector") {
	static readonly layer: Layer.Layer<FormatSelector> = Layer.succeed(this, {
		select: (executor, explicit, env) =>
			Effect.succeed<OutputFormat>(
				explicit ??
					(env === "ci-github" && executor === "ci"
						? "ci-annotations"
						: executor === "agent"
							? "markdown"
							: executor === "ci"
								? "json"
								: "terminal"),
			),
	});
}
