// packages/tsdown-plugins/src/report/services/EnvironmentDetector.ts
import type { Effect } from "effect";
import { Context } from "effect";

/** @public */
export type Environment = "agent-shell" | "terminal" | "ci-github" | "ci-generic";

/** @public */
export class EnvironmentDetector extends Context.Tag("@savvy-web/tsdown-plugins/EnvironmentDetector")<
	EnvironmentDetector,
	{ readonly detect: () => Effect.Effect<Environment> }
>() {}
