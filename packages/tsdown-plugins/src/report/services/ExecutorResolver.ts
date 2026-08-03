// packages/tsdown-plugins/src/report/services/ExecutorResolver.ts
import { Context, Effect, Layer } from "effect";
import type { Environment } from "./EnvironmentDetector.js";

/** @public */
export type Executor = "human" | "agent" | "ci";

/** @public */
export class ExecutorResolver extends Context.Service<
	ExecutorResolver,
	{ readonly resolve: (env: Environment) => Effect.Effect<Executor> }
>()("@savvy-web/tsdown-plugins/ExecutorResolver") {
	static readonly layer: Layer.Layer<ExecutorResolver> = Layer.succeed(this, {
		resolve: (env) => Effect.succeed<Executor>(env === "agent-shell" ? "agent" : env === "terminal" ? "human" : "ci"),
	});
}
