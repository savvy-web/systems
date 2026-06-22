// packages/tsdown-plugins/src/report/layers/ExecutorResolverLive.ts
import { Effect, Layer } from "effect";
import type { Executor } from "../services/ExecutorResolver.js";
import { ExecutorResolver } from "../services/ExecutorResolver.js";

/** @public */
export const ExecutorResolverLive = Layer.succeed(ExecutorResolver, {
	resolve: (env) => Effect.succeed<Executor>(env === "agent-shell" ? "agent" : env === "terminal" ? "human" : "ci"),
});
