// packages/tsdown-plugins/src/report/services/ExecutorResolver.ts
import type { Effect } from "effect";
import { Context } from "effect";
import type { Environment } from "./EnvironmentDetector.js";

/** @public */
export type Executor = "human" | "agent" | "ci";

/** @public */
export class ExecutorResolver extends Context.Tag("@savvy-web/tsdown-plugins/ExecutorResolver")<
	ExecutorResolver,
	{ readonly resolve: (env: Environment) => Effect.Effect<Executor> }
>() {}
