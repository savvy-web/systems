import { Effect, Layer } from "effect";
import { isAgent, isCI } from "std-env";
import type { Environment } from "../services/EnvironmentDetector.js";
import { EnvironmentDetector } from "../services/EnvironmentDetector.js";

const isGitHub = (): boolean => process.env.GITHUB_ACTIONS === "true" || process.env.GITHUB_ACTIONS === "1";

/** @public */
export const EnvironmentDetectorLive = Layer.succeed(EnvironmentDetector, {
	detect: () =>
		Effect.sync((): Environment => {
			if (isAgent) return "agent-shell";
			if (isGitHub()) return "ci-github";
			if (isCI) return "ci-generic";
			// spec: TTY/human tier — terminal is the human default when interactive.
			return "terminal";
		}),
});
