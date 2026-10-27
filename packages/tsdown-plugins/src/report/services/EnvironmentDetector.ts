// packages/tsdown-plugins/src/report/services/EnvironmentDetector.ts
import type { RuntimeEnv } from "@effected/env";
import { CurrentRuntimeEnv } from "@effected/env";
import { Context, Effect, Layer, Option } from "effect";

/** @public */
export type Environment = "agent-shell" | "terminal" | "ci-github" | "ci-generic";

/**
 * Classify a runtime snapshot: an agent wins over CI, GitHub Actions is told apart from every other CI, and the
 * human terminal is the default.
 */
const classify = (env: RuntimeEnv): Environment => {
	if (Option.isSome(env.agent)) return "agent-shell";
	if (Option.isSome(env.ci)) return env.ci.value === "github-actions" ? "ci-github" : "ci-generic";
	return "terminal";
};

/** @public */
export class EnvironmentDetector extends Context.Service<
	EnvironmentDetector,
	{ readonly detect: () => Effect.Effect<Environment> }
>()("@savvy-web/tsdown-plugins/EnvironmentDetector") {
	/**
	 * Detects from `@effected/env`'s `CurrentRuntimeEnv`, read through the ambient `ConfigProvider` (the process
	 * environment by default) once, when the layer is built.
	 */
	static readonly layer: Layer.Layer<EnvironmentDetector> = Layer.effect(
		this,
		Effect.map(CurrentRuntimeEnv, (env) => {
			const environment = classify(env);
			return { detect: () => Effect.succeed(environment) };
		}),
	).pipe(Layer.provide(CurrentRuntimeEnv.layer));
}
