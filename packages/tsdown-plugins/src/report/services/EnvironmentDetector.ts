// packages/tsdown-plugins/src/report/services/EnvironmentDetector.ts
import { Context, Effect, Layer } from "effect";
import { isAgent, isCI } from "std-env";

/** @public */
export type Environment = "agent-shell" | "terminal" | "ci-github" | "ci-generic";

const isGitHub = (): boolean => process.env.GITHUB_ACTIONS === "true" || process.env.GITHUB_ACTIONS === "1";

/** @public */
export class EnvironmentDetector extends Context.Service<
	EnvironmentDetector,
	{ readonly detect: () => Effect.Effect<Environment> }
>()("@savvy-web/tsdown-plugins/EnvironmentDetector") {
	static readonly layer: Layer.Layer<EnvironmentDetector> = Layer.succeed(this, {
		detect: () =>
			Effect.sync((): Environment => {
				if (isAgent) return "agent-shell";
				if (isGitHub()) return "ci-github";
				if (isCI) return "ci-generic";
				// spec: TTY/human tier — terminal is the human default when interactive.
				return "terminal";
			}),
	});
}
